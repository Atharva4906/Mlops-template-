"""Operational MLOps lifecycle for ticket routing.

Optional integrations are deliberately lazy-loaded so ticket ingestion does not
depend on an MLflow server, DVC repository, or Evidently installation.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import time
import asyncio
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from services import db_service

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
ARTIFACT_DIR = ROOT / "mlops_artifacts"
DATASET_PATH = ARTIFACT_DIR / "resolved_tickets.jsonl"
MODEL_PATH = ARTIFACT_DIR / "ticket_routing_challenger.joblib"
STATE_PATH = ARTIFACT_DIR / "mlops_state.json"
DVC_PROJECT_PATH = Path(os.getenv("DVC_PROJECT_PATH", str(REPOSITORY_ROOT)))
DVC_DATASET_PATH = DATASET_PATH.relative_to(DVC_PROJECT_PATH)
MIN_DRIFT_SAMPLES = max(int(os.getenv("MLOPS_MIN_DRIFT_SAMPLES", "10")), 2)
ARTIFACT_DIR.mkdir(exist_ok=True)


def _read_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"champion_version": os.getenv("MLFLOW_ROUTING_MODEL_VERSION", "local-logistic-regression-v1")}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_state(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _psi(expected: list[float], actual: list[float], bins: int = 10) -> float:
    if not expected or not actual:
        return 0.0
    edges = np.linspace(0.0, 1.0, bins + 1)
    expected_hist, _ = np.histogram(np.clip(expected, 0, 1), bins=edges)
    actual_hist, _ = np.histogram(np.clip(actual, 0, 1), bins=edges)
    expected_ratio = np.maximum(expected_hist / max(len(expected), 1), 1e-6)
    actual_ratio = np.maximum(actual_hist / max(len(actual), 1), 1e-6)
    return float(np.sum((actual_ratio - expected_ratio) * np.log(actual_ratio / expected_ratio)))


def _distribution_psi(expected: Counter[str], actual: Counter[str]) -> float:
    keys = sorted(set(expected) | set(actual))
    if not keys:
        return 0.0
    expected_total = max(sum(expected.values()), 1)
    actual_total = max(sum(actual.values()), 1)
    expected_values = [expected[key] / expected_total for key in keys]
    actual_values = [actual[key] / actual_total for key in keys]
    return _psi(expected_values, actual_values, bins=max(len(keys), 2))


def _metric_values(tickets: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(tickets)
    reassigned = sum(bool(ticket.get("was_reassigned")) for ticket in tickets)
    fallback = sum(ticket.get("model_provider") == "groq" for ticket in tickets)
    errors = sum(
        any(item.get("status") == "error" for item in ticket.get("trace", []))
        for ticket in tickets
    )
    token_count = sum(int(ticket.get("token_count") or 0) for ticket in tickets)
    token_cost = sum(float(ticket.get("token_cost_usd") or 0) for ticket in tickets)
    latencies = sorted(float(ticket.get("routing_latency_ms") or 0) for ticket in tickets)
    p95_index = min(max(math.ceil(len(latencies) * 0.95) - 1, 0), len(latencies) - 1) if latencies else 0
    return {
        "total_tickets": total,
        "auto_route_percentage": round((total - reassigned) / total * 100, 2) if total else 0,
        "bounce_reassignment_percentage": round(reassigned / total * 100, 2) if total else 0,
        "groq_fallback_percentage": round(fallback / total * 100, 2) if total else 0,
        "p95_routing_latency_ms": round(latencies[p95_index], 2) if latencies else 0,
        "error_rate_percentage": round(errors / total * 100, 2) if total else 0,
        "llm_token_count": token_count,
        "llm_token_cost_usd": round(token_cost, 6),
        "queue_distribution": dict(Counter(ticket.get("specialist_queue", "unassigned") for ticket in tickets)),
    }


def collect_metrics(tickets: list[dict[str, Any]]) -> dict[str, Any]:
    state = _read_state()
    metrics = _metric_values(tickets)
    drift = state.get("last_drift", {"status": "not_evaluated", "overall": 0.0})
    baseline_count = len(state.get("baseline", {}).get("confidence", []))
    drift_ready = len(tickets) >= MIN_DRIFT_SAMPLES and baseline_count >= MIN_DRIFT_SAMPLES
    return {
        **metrics,
        "drift": drift,
        "current_mlflow_model_version": state.get("champion_version", "not_configured"),
        "mlflow_enabled": bool(os.getenv("MLFLOW_TRACKING_URI")),
        "dvc_enabled": _dvc_repository_ready() and _optional_available("dvc"),
        "evidently_enabled": _optional_available("evidently"),
        "evidently_ready": drift_ready and _optional_available("evidently"),
        "drift_ready": drift_ready,
        "drift_minimum_samples": MIN_DRIFT_SAMPLES,
        "drift_current_samples": len(tickets),
        "drift_baseline_samples": baseline_count,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _optional_available(module_name: str) -> bool:
    try:
        __import__(module_name)
        return True
    except (ImportError, AttributeError, ModuleNotFoundError):
        return False


def _dvc_repository_ready() -> bool:
    return (DVC_PROJECT_PATH / ".dvc" / "config").exists()


def _version_dataset_with_dvc() -> dict[str, Any]:
    if not _dvc_repository_ready():
        return {"enabled": False, "status": "not_initialized"}
    try:
        result = subprocess.run(
            ["dvc", "add", str(DVC_DATASET_PATH)],
            cwd=DVC_PROJECT_PATH,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        print(f"[MLOps] DVC executable unavailable: {exc}")
        return {"enabled": True, "status": "unavailable", "detail": str(exc)}
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        print(f"[MLOps] DVC dataset versioning failed: {detail}")
        return {"enabled": True, "status": "error", "detail": detail}
    return {"enabled": True, "status": "versioned", "path": str(DVC_DATASET_PATH)}


def evaluate_drift(tickets: list[dict[str, Any]]) -> dict[str, Any]:
    state = _read_state()
    baseline = state.get("baseline", {})
    baseline_count = len(baseline.get("confidence", []))
    if len(tickets) < MIN_DRIFT_SAMPLES or (baseline and baseline_count < MIN_DRIFT_SAMPLES):
        result = {
            "status": "waiting_for_data",
            "provider": "evidently" if _optional_available("evidently") else "local-psi",
            "minimum_samples": MIN_DRIFT_SAMPLES,
            "current_samples": len(tickets),
            "baseline_samples": baseline_count,
            "detail": "Drift evaluation starts after the minimum baseline and current sample sizes are available.",
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }
        state["last_drift"] = result
        _write_state(state)
        return result
    current_confidence = [float(ticket.get("confidence") or 0) for ticket in tickets]
    current_embedding_signal = [
        float((ticket.get("embedding") or [0.0])[0])
        for ticket in tickets
        if ticket.get("embedding")
    ]
    current_queues = Counter(ticket.get("specialist_queue", "unassigned") for ticket in tickets)
    embedding_psi = _psi(baseline.get("embedding_signal", current_embedding_signal), current_embedding_signal)
    queue_psi = _distribution_psi(Counter(baseline.get("queues", {})), current_queues) if baseline.get("queues") else 0.0
    thresholds = {"embedding_psi": 0.2, "queue_psi": 0.2}
    result = {
        "status": "drift" if embedding_psi >= thresholds["embedding_psi"] or queue_psi >= thresholds["queue_psi"] else "stable",
        "embedding_psi": round(embedding_psi, 5),
        "queue_distribution_psi": round(queue_psi, 5),
        "thresholds": thresholds,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "provider": "evidently" if _optional_available("evidently") else "local-psi",
    }
    if not baseline and current_confidence:
        state["baseline"] = {
            "confidence": current_confidence,
            "embedding_signal": current_embedding_signal,
            "queues": dict(current_queues),
        }
    state["last_drift"] = result
    _write_state(state)
    return result


def _export_resolved_tickets(fallback_tickets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    try:
        rows = db_service.get_resolved_tickets()
    except (RuntimeError, ValueError, TypeError) as exc:
        print(f"[MLOps] Supabase export unavailable; using local resolved tickets: {exc}")
        rows = [ticket for ticket in fallback_tickets if ticket.get("status") == "resolved"]
    records = [
        {
            "text": f"{row.get('subject_scrubbed', row.get('subject', ''))}\n"
                    f"{row.get('content_scrubbed', row.get('content', ''))}",
            "intent": row.get("intent", "general"),
            "queue": row.get("queue", row.get("specialist_queue", "general-specialists")),
            "weight": 2.5 if row.get("was_reassigned") else 1.0,
        }
        for row in rows
    ]
    ARTIFACT_DIR.mkdir(exist_ok=True)
    with DATASET_PATH.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record) + "\n")
    return records


def _log_mlflow(records: list[dict[str, Any]], f1: float, version: str, model: Any) -> str | None:
    if not os.getenv("MLFLOW_TRACKING_URI"):
        return None
    try:
        import mlflow
        import mlflow.sklearn
        from mlflow.exceptions import MlflowException
    except ImportError:
        print("[MLOps] MLflow is not installed; skipping experiment logging")
        return None
    try:
        mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI"))
        mlflow.set_experiment(os.getenv("MLFLOW_EXPERIMENT_NAME", "ticket-routing"))
        with mlflow.start_run(run_name=f"ticket-routing-{version}"):
            mlflow.log_metrics({"weighted_f1": f1, "training_rows": len(records)})
            mlflow.log_param("sample_weight", "reassigned=2.5")
            mlflow.log_artifact(str(DATASET_PATH))
            model_info = mlflow.sklearn.log_model(
                model,
                artifact_path="model",
                registered_model_name=os.getenv("MLFLOW_REGISTERED_MODEL", "ticket-routing"),
            )
            return model_info.model_uri
    except (OSError, RuntimeError, ValueError, MlflowException) as exc:
        print(f"[MLOps] MLflow logging unavailable: {exc}")
        return None


def retrain(tickets: list[dict[str, Any]]) -> dict[str, Any]:
    records = _export_resolved_tickets(tickets)
    if not records:
        return {"status": "blocked", "detail": "No resolved tickets available for retraining."}
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import f1_score
    from services.hybrid_routing import EmbeddingService

    embedder = EmbeddingService()
    feature_padding = np.zeros(6, dtype=np.float32)
    matrix = np.asarray([
        embedder.encode(record["text"]) + feature_padding.tolist()
        for record in records
    ], dtype=np.float32)
    labels = [record["intent"] for record in records]
    unique_labels = sorted(set(labels))
    if len(unique_labels) < 2:
        return {
            "status": "blocked",
            "detail": "At least two distinct intent classes are required for challenger training.",
            "classes_found": unique_labels,
            "rows": len(records),
        }
    weights = np.asarray([record["weight"] for record in records], dtype=np.float32)
    model = LogisticRegression(max_iter=300, random_state=7)
    model.fit(matrix, labels, sample_weight=weights)
    predictions = model.predict(matrix)
    f1 = float(f1_score(labels, predictions, average="weighted", zero_division=0))
    version = f"challenger-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    import joblib

    joblib.dump(model, MODEL_PATH)
    mlflow_model_uri = _log_mlflow(records, f1, version, model)
    state = _read_state()
    state["challenger"] = {
        "version": version,
        "weighted_f1": f1,
        "artifact": str(MODEL_PATH),
        "mlflow_model_uri": mlflow_model_uri,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _write_state(state)
    if mlflow_model_uri:
        try:
            import mlflow
            from mlflow import MlflowClient

            client = MlflowClient()
            model_name = os.getenv("MLFLOW_REGISTERED_MODEL", "ticket-routing")
            versions = client.search_model_versions(f"name='{model_name}'")
            latest_version = max(versions, key=lambda item: int(item.version)).version
            client.set_registered_model_alias(model_name, "Champion", latest_version)
        except (ImportError, OSError, RuntimeError, ValueError) as exc:
            print(f"[MLOps] Champion alias update unavailable: {exc}")
    dvc_result = _version_dataset_with_dvc()
    return {
        "status": "completed",
        "version": version,
        "weighted_f1": round(f1, 5),
        "rows": len(records),
        "dvc": dvc_result,
    }


def promote_challenger() -> dict[str, Any]:
    state = _read_state()
    challenger = state.get("challenger")
    champion_f1 = float(state.get("champion_f1", 0))
    if not challenger:
        return {"status": "blocked", "detail": "No challenger model is available."}
    if float(challenger["weighted_f1"]) <= champion_f1:
        return {"status": "rejected", "champion_version": state.get("champion_version"), "champion_f1": champion_f1, "challenger_f1": challenger["weighted_f1"]}
    state["champion_version"] = challenger["version"]
    state["champion_f1"] = challenger["weighted_f1"]
    state["model_path"] = challenger["artifact"]
    _write_state(state)
    os.environ["MLFLOW_ROUTING_MODEL_VERSION"] = challenger["version"]
    try:
        from services.ticket_api import pipeline

        pipeline.hybrid.classifier.reload(challenger["artifact"])
        hot_reload = True
    except (ImportError, OSError, RuntimeError, ValueError) as exc:
        print(f"[MLOps] Model promoted but hot reload failed: {exc}")
        hot_reload = False
    return {
        "status": "promoted",
        "champion_version": state["champion_version"],
        "champion_f1": state["champion_f1"],
        "hot_reloaded": hot_reload,
    }


async def scheduled_drift_loop(get_tickets: Any) -> None:
    """Run drift evaluation on a configurable daily cadence."""
    interval = max(int(os.getenv("MLOPS_DRIFT_INTERVAL_SECONDS", "86400")), 60)
    while True:
        try:
            evaluate_drift(list(get_tickets()))
        except (OSError, RuntimeError, ValueError, TypeError) as exc:
            print(f"[MLOps] Scheduled drift evaluation failed: {exc}")
        await asyncio.sleep(interval)
