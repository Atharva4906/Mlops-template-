"""Hybrid ticket routing orchestration.

The service keeps routing synchronous for the existing ingestion API while
using LangGraph nodes to make each decision stage observable and replaceable.
External providers are optional: local embeddings and the deterministic
classifier remain available when a model, Supabase, MLflow, or Groq is absent.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, TypedDict

import numpy as np
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph
from postgrest.exceptions import APIError

load_dotenv()

EMBEDDING_DIMENSION = 384
HIGH_CONFIDENCE = float(os.getenv("ROUTING_HIGH_CONFIDENCE", "0.85"))
VERY_LOW_CONFIDENCE = float(os.getenv("ROUTING_VERY_LOW_CONFIDENCE", "0.45"))
GROQ_MODEL = os.getenv("GROQ_ROUTING_MODEL", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"))


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


class RoutingState(TypedDict, total=False):
    payload: dict[str, Any]
    scrubbed_subject: str
    scrubbed_content: str
    entities: list[dict[str, str]]
    embedding: list[float]
    embedding_provider: str
    resolved_examples: list[dict[str, Any]]
    duplicate_outage: bool
    outage_matches: list[dict[str, Any]]
    intent: str
    sentiment: str
    confidence: float
    explanation: list[dict[str, Any]]
    model_provider: str
    customer_features: dict[str, float]
    groq_result: dict[str, Any]
    routing_decision: str
    trace: list[dict[str, Any]]
    error: str


class EmbeddingService:
    """Generate BGE-small-sized vectors with a deterministic local fallback."""

    def __init__(self) -> None:
        self.model_name = os.getenv("ROUTING_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
        self._model: Any = None
        self.provider = "hash"

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model
        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
            self.provider = "sentence-transformers-bge-small"
        except (ImportError, OSError, RuntimeError) as exc:
            print(f"[Routing] BGE embedding model unavailable; using 384-d hash vectors: {exc}")
            self._model = False
        return self._model

    def encode(self, text: str) -> list[float]:
        model = self._load_model()
        if model:
            vector = model.encode(text, normalize_embeddings=True)
            values = np.asarray(vector, dtype=np.float32).reshape(-1)
            if values.size == EMBEDDING_DIMENSION:
                return values.tolist()
            print(f"[Routing] Embedding model returned {values.size} dimensions; using hash fallback")
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        values = np.zeros(EMBEDDING_DIMENSION, dtype=np.float32)
        for index in range(EMBEDDING_DIMENSION):
            values[index] = ((digest[index % len(digest)] / 255.0) * 2.0) - 1.0
        norm = float(np.linalg.norm(values))
        return (values / norm if norm else values).tolist()


class CustomerFeatureExtractor:
    def extract(self, payload: dict[str, Any]) -> dict[str, float]:
        content = str(payload.get("content") or payload.get("body") or "")
        sender = str(payload.get("sender") or "")
        return {
            "channel_email": float(payload.get("channel", "email") == "email"),
            "channel_chat": float(payload.get("channel") == "chat"),
            "content_length": min(len(content), 4000) / 4000.0,
            "thread_length": min(float(payload.get("thread_length") or 1), 20.0) / 20.0,
            "has_customer_tier": float(bool(payload.get("customer_tier"))),
            "known_sender": float(bool(sender and "@" in sender)),
        }


class EmbeddingClassifier:
    """Champion-model adapter with a small trained sklearn fallback."""

    def __init__(self, embedding_service: EmbeddingService) -> None:
        self.embedding_service = embedding_service
        self.feature_names = (
            "channel_email",
            "channel_chat",
            "content_length",
            "thread_length",
            "has_customer_tier",
            "known_sender",
        )
        self.model: Any = None
        self.provider = "trained-local"
        self._load_mlflow_model()

    def _load_mlflow_model(self) -> None:
        model_uri = os.getenv("MLFLOW_ROUTING_MODEL_URI")
        if not model_uri:
            return
        try:
            import mlflow
            from mlflow.exceptions import MlflowException
        except ImportError:
            print("[Routing] MLflow is not installed; using trained local model")
            return
        try:
            self.model = mlflow.pyfunc.load_model(model_uri)
            self.provider = f"mlflow:{model_uri}"
        except (OSError, RuntimeError, ValueError, MlflowException) as exc:
            print(f"[Routing] MLflow champion unavailable; using trained local model: {exc}")

    def _train_fallback(self) -> Any:
        from sklearn.linear_model import LogisticRegression

        examples = {
            "fraud": ("unauthorized transaction stolen card scam",),
            "billing": ("invoice charge refund payment billing",),
            "account": ("login password locked verify account access",),
            "technical": ("error broken crash bug not working failure",),
            "general": ("question information request help",),
        }
        texts: list[str] = []
        labels: list[str] = []
        for label, values in examples.items():
            for value in values:
                texts.append(value)
                labels.append(label)
        feature_padding = np.zeros(len(self.feature_names), dtype=np.float32)
        matrix = np.asarray([
            self.embedding_service.encode(value) + feature_padding.tolist() for value in texts
        ], dtype=np.float32)
        model = LogisticRegression(max_iter=300, random_state=7)
        model.fit(matrix, labels)
        return model

    def predict(self, text: str, customer_features: dict[str, float]) -> tuple[str, float, str]:
        if self.model is None:
            self.model = self._train_fallback()
        features = [float(customer_features.get(name, 0.0)) for name in self.feature_names]
        vector = np.asarray([self.embedding_service.encode(text) + features], dtype=np.float32)
        if self.provider.startswith("mlflow"):
            result = self.model.predict(vector)
            intent = str(result[0])
            return intent, 0.7, self.provider
        probabilities = self.model.predict_proba(vector)[0]
        index = int(np.argmax(probabilities))
        return str(self.model.classes_[index]), float(probabilities[index]), self.provider

    def reload(self, model_path: str | None = None) -> None:
        if model_path:
            import joblib

            self.model = joblib.load(model_path)
            self.provider = f"hot-reloaded:{model_path}"
            return
        self.model = None
        self.provider = "trained-local"
        self._load_mlflow_model()


class GroqRoutingFallback:
    def __init__(self) -> None:
        self._client: Any = None

    def route(self, state: RoutingState) -> dict[str, Any] | None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return None
        try:
            from groq import APIConnectionError, APIStatusError, AuthenticationError, Groq, RateLimitError

            if self._client is None:
                self._client = Groq(api_key=api_key)
            response = self._client.chat.completions.create(
                model=GROQ_MODEL,
                temperature=0,
                max_tokens=700,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Route a support ticket. Return JSON only with keys "
                            "predicted_queue, urgency, extracted_entities, reasoning_trace, "
                            "suggested_first_response. predicted_queue must be one of "
                            "fraud-specialists, billing-specialists, account-specialists, "
                            "technical-specialists, general-specialists."
                        ),
                    },
                    {
                        "role": "user",
                        "content": json.dumps({
                            "subject": state.get("scrubbed_subject", ""),
                            "content": state.get("scrubbed_content", ""),
                            "local_intent": state.get("intent", "general"),
                            "resolved_examples": state.get("resolved_examples", [])[:3],
                        }),
                    },
                ],
            )
            parsed = json.loads(response.choices[0].message.content or "{}")
            required = ("predicted_queue", "urgency", "extracted_entities", "reasoning_trace", "suggested_first_response")
            if not all(key in parsed for key in required):
                raise ValueError("Groq routing response omitted a required field")
            return parsed
        except (
            APIConnectionError,
            APIStatusError,
            AuthenticationError,
            RateLimitError,
            ImportError,
            OSError,
            RuntimeError,
            ValueError,
            TypeError,
            json.JSONDecodeError,
        ) as exc:
            print(f"[Routing] Groq fallback unavailable: {exc}")
            return None


class HybridRoutingOrchestrator:
    def __init__(self, scrubber: Any, router: Any, classifier: Any) -> None:
        self.scrubber = scrubber
        self.router = router
        self.keyword_classifier = classifier
        self.embedding_service = EmbeddingService()
        self.feature_extractor = CustomerFeatureExtractor()
        self.classifier = EmbeddingClassifier(self.embedding_service)
        self.groq = GroqRoutingFallback()
        self._graph = self._build_graph()

    def _node(self, name: str, function: Any) -> Any:
        def wrapped(state: RoutingState) -> RoutingState:
            started = time.perf_counter()
            trace = list(state.get("trace", []))
            try:
                result = function(state)
                trace.append({"node": name, "status": "ok", "duration_ms": round((time.perf_counter() - started) * 1000, 2)})
                result["trace"] = trace
                return result
            except Exception as exc:
                trace.append({"node": name, "status": "error", "duration_ms": round((time.perf_counter() - started) * 1000, 2), "error": str(exc)})
                state["trace"] = trace
                state["error"] = f"{name}: {exc}"
                return state
        return wrapped

    def _build_graph(self) -> Any:
        graph = StateGraph(RoutingState)
        graph.add_node("scrub", self._node("scrub", self._scrub))
        graph.add_node("embed", self._node("embed", self._embed))
        graph.add_node("retrieve", self._node("retrieve", self._retrieve))
        graph.add_node("classify", self._node("classify", self._classify))
        graph.add_node("groq_fallback", self._node("groq_fallback", self._groq_fallback))
        graph.add_node("decide", self._node("decide", self._decide))
        graph.set_entry_point("scrub")
        graph.add_edge("scrub", "embed")
        graph.add_edge("embed", "retrieve")
        graph.add_edge("retrieve", "classify")
        graph.add_conditional_edges("classify", self._confidence_branch, {"groq": "groq_fallback", "decide": "decide"})
        graph.add_edge("groq_fallback", "decide")
        graph.add_edge("decide", END)
        return graph.compile()

    def _scrub(self, state: RoutingState) -> RoutingState:
        payload = state["payload"]
        subject = self.scrubber.scrub(str(payload.get("subject") or ""))
        content = self.scrubber.scrub(str(payload.get("content") or payload.get("body") or ""))
        return {"scrubbed_subject": subject.text, "scrubbed_content": content.text, "entities": subject.entities + content.entities}

    def _embed(self, state: RoutingState) -> RoutingState:
        text = f"{state.get('scrubbed_subject', '')}\n{state.get('scrubbed_content', '')}"
        return {"embedding": self.embedding_service.encode(text), "embedding_provider": self.embedding_service.provider}

    def _retrieve(self, state: RoutingState) -> RoutingState:
        from services import db_service

        try:
            matches = db_service.search_ticket_embeddings(state["embedding"], match_count=3, only_resolved=True)
            outages = db_service.search_ticket_embeddings(state["embedding"], match_count=10, only_resolved=False, match_threshold=0.88)
        except (APIError, RuntimeError, ValueError, TypeError) as exc:
            print(f"[Routing] Vector retrieval unavailable: {exc}")
            matches, outages = [], []
        duplicate = len(outages) >= 2
        return {"resolved_examples": matches[:3], "outage_matches": outages, "duplicate_outage": duplicate}

    def _classify(self, state: RoutingState) -> RoutingState:
        text = f"{state.get('scrubbed_subject', '')}\n{state.get('scrubbed_content', '')}"
        features = self.feature_extractor.extract(state["payload"])
        intent, confidence, provider = self.classifier.predict(text, features)
        keyword_intent, keyword_sentiment, keyword_confidence = self.keyword_classifier.predict(text)
        if keyword_intent != "general":
            intent, confidence, provider = keyword_intent, keyword_confidence, "hybrid-keyword+trained-local"
            sentiment = keyword_sentiment
        else:
            sentiment = "urgent" if any(term in text.lower() for term in ("urgent", "asap", "critical", "immediately")) else "neutral"
        explanation = [{"token": token, "weight": weight} for token, weight in self._explanation_terms(text, intent)]
        return {
            "intent": intent,
            "sentiment": sentiment,
            "confidence": round(confidence, 3),
            "model_provider": provider,
            "customer_features": features,
            "explanation": explanation[:5],
        }

    def _explanation_terms(self, text: str, intent: str) -> list[tuple[str, float]]:
        keywords = {
            "fraud": ("fraud", "unauthorized", "stolen", "scam"),
            "billing": ("charge", "invoice", "refund", "payment"),
            "account": ("login", "password", "locked", "access"),
            "technical": ("error", "broken", "crash", "failed"),
        }.get(intent, ())
        return [(term, 0.42) for term in dict.fromkeys(re.findall(r"[a-zA-Z][a-zA-Z'-]{2,}", text.lower())) if term in keywords]

    def _confidence_branch(self, state: RoutingState) -> str:
        return "groq" if float(state.get("confidence", 0)) < HIGH_CONFIDENCE else "decide"

    def _groq_fallback(self, state: RoutingState) -> RoutingState:
        result = self.groq.route(state)
        if result:
            queue = str(result["predicted_queue"])
            intent = queue.removesuffix("-specialists")
            return {"groq_result": result, "intent": intent, "model_provider": "groq", "confidence": max(float(state.get("confidence", 0)), VERY_LOW_CONFIDENCE)}
        return {"groq_result": {}, "model_provider": state.get("model_provider", "trained-local")}

    def _decide(self, state: RoutingState) -> RoutingState:
        confidence = float(state.get("confidence", 0))
        decision = "auto_route" if confidence >= HIGH_CONFIDENCE else "human_triage" if confidence < VERY_LOW_CONFIDENCE else "fallback_route"
        return {"routing_decision": decision}

    def process(self, payload: dict[str, Any]) -> dict[str, Any]:
        started = time.perf_counter()
        result = self._graph.invoke({"payload": payload, "trace": []})
        route = self.router.route(result.get("intent", "general"))
        groq = result.get("groq_result") or {}
        if groq.get("predicted_queue"):
            route["specialist_queue"] = groq["predicted_queue"]
        now = datetime.now(timezone.utc).isoformat()
        return {
            "id": payload.get("id"),
            "channel": payload.get("channel", "email"),
            "subject": result.get("scrubbed_subject", ""),
            "content": result.get("scrubbed_content", ""),
            "intent": result.get("intent", "general"),
            "sentiment": result.get("sentiment", "neutral"),
            "confidence": result.get("confidence", 0.0),
            "domain": route["domain"],
            "domain_name": route["domain_name"],
            "specialist_queue": route["specialist_queue"],
            "explanation": result.get("explanation", []),
            "entities": result.get("entities", []),
            "urgency": groq.get("urgency", result.get("sentiment", "neutral")),
            "reasoning_trace": groq.get("reasoning_trace", []),
            "suggested_first_response": groq.get("suggested_first_response", ""),
            "embedding": result.get("embedding", []),
            "embedding_provider": result.get("embedding_provider", "hash"),
            "resolved_examples": result.get("resolved_examples", [])[:3],
            "duplicate_outage": result.get("duplicate_outage", False),
            "outage_matches": result.get("outage_matches", []),
            "routing_decision": result.get("routing_decision", "human_triage"),
            "model_provider": result.get("model_provider", "trained-local"),
            "model_version": os.getenv("MLFLOW_ROUTING_MODEL_VERSION", "local-logistic-regression-v1"),
            "routing_latency_ms": round((time.perf_counter() - started) * 1000),
            "trace": result.get("trace", []),
            "status": "open",
            "created_at": now,
            "updated_at": now,
        }
