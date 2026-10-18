"""Privacy-first support ticket processing primitives and hybrid orchestration."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any
from services.hybrid_routing import HybridRoutingOrchestrator


@dataclass(frozen=True)
class ScrubResult:
    text: str
    entities: list[dict[str, str]]


@dataclass(frozen=True)
class Prediction:
    intent: str
    sentiment: str
    confidence: float
    explanation: list[dict[str, Any]]


class PIIScrubber:
    """Replace common PII with stable, non-reversible display tokens."""

    _patterns = (
        ("EMAIL", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)),
        ("PHONE", re.compile(r"(?<!\w)(?:\+?\d[\d .()\-]{7,}\d)(?!\w)")),
        ("CARD", re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")),
    )

    def scrub(self, text: str) -> ScrubResult:
        entities: list[dict[str, str]] = []
        scrubbed = text or ""
        for entity_type, pattern in self._patterns:
            def replace(match: re.Match[str]) -> str:
                value = match.group(0)
                digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:10]
                token = f"<{entity_type}_{digest}>"
                entities.append({"type": entity_type, "token": token})
                return token

            scrubbed = pattern.sub(replace, scrubbed)
        return ScrubResult(text=scrubbed, entities=entities)


class LocalClassifier:
    """Small local fallback classifier used until SageMaker is configured."""

    _intent_keywords = {
        "fraud": ("fraud", "unauthorized", "without permission", "stolen", "scam"),
        "billing": ("charge", "charged", "invoice", "refund", "payment", "billing"),
        "account": ("login", "password", "account", "verify", "locked", "access"),
        "technical": ("error", "bug", "broken", "failed", "crash", "not working"),
    }
    _urgent_terms = ("urgent", "asap", "immediately", "critical", "angry", "frustrated")

    def predict(self, text: str) -> tuple[str, str, float]:
        normalized = (text or "").lower()
        scores = {
            intent: sum(normalized.count(keyword) for keyword in keywords)
            for intent, keywords in self._intent_keywords.items()
        }
        intent, score = max(scores.items(), key=lambda item: item[1])
        if score == 0:
            intent, score = "general", 0
        sentiment = "urgent" if any(term in normalized for term in self._urgent_terms) else "neutral"
        confidence = min(0.99, 0.55 + (0.1 * score)) if score else 0.5
        return intent, sentiment, round(confidence, 3)


class LocalExplainer:
    """Return bounded trigger terms compatible with a future SHAP response."""

    def explain(self, text: str, intent: str, limit: int = 5) -> list[dict[str, Any]]:
        terms = re.findall(r"[a-zA-Z][a-zA-Z'-]{2,}", (text or "").lower())
        keywords = set(LocalClassifier._intent_keywords.get(intent, ()))
        ranked: list[dict[str, Any]] = []
        for term in terms:
            if term in keywords or intent == "general":
                weight = 0.42 if term in keywords else 0.08
                if not any(item["token"] == term for item in ranked):
                    ranked.append({"token": term, "weight": weight})
        return ranked[:limit]


class RoutingEngine:
    """Map model intent labels to configurable domains and queues."""

    def __init__(
        self,
        mapping: dict[str, str] | None = None,
        domains: dict[str, dict[str, str]] | None = None,
    ) -> None:
        self.domains = domains or {
            "fraud": {"slug": "fraud", "name": "Fraud", "specialist_queue": "fraud-specialists"},
            "billing": {"slug": "billing", "name": "Billing", "specialist_queue": "billing-specialists"},
            "account": {"slug": "account", "name": "Account", "specialist_queue": "account-specialists"},
            "technical": {"slug": "technical", "name": "Technical", "specialist_queue": "technical-specialists"},
            "general": {"slug": "general", "name": "General", "specialist_queue": "general-specialists"},
        }
        self.mapping = mapping or {intent: intent for intent in self.domains}

    def route(self, intent: str) -> dict[str, str]:
        domain_key = self.mapping.get(intent, self.mapping.get("general", "general"))
        domain = self.domains.get(domain_key) or self.domains["general"]
        return {
            "domain": domain["slug"],
            "domain_name": domain["name"],
            "specialist_queue": domain["specialist_queue"],
        }


class TicketPipeline:
    def __init__(
        self,
        scrubber: PIIScrubber | None = None,
        routing: RoutingEngine | None = None,
    ) -> None:
        self.scrubber = scrubber or PIIScrubber()
        self.classifier = LocalClassifier()
        self.explainer = LocalExplainer()
        self.router = routing or RoutingEngine()
        self.hybrid = HybridRoutingOrchestrator(self.scrubber, self.router, self.classifier)

    def process(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.hybrid.process(payload)
