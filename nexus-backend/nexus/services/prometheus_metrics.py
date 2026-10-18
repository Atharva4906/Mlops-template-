"""Application metrics exported through the Prometheus default registry."""

from __future__ import annotations

from typing import Any

from prometheus_client import Counter, Gauge, Histogram


ticket_routing_total = Counter(
    "ticket_routing_total",
    "Total number of tickets routed.",
    ("channel", "intent", "queue"),
)
ticket_auto_route_total = Counter(
    "ticket_auto_route_total",
    "Tickets routed without human reassignment.",
)
ticket_reassignment_total = Counter(
    "ticket_reassignment_total",
    "Tickets reassigned by a specialist.",
    ("from_queue", "to_queue"),
)
ticket_groq_fallback_total = Counter(
    "ticket_groq_fallback_total",
    "Tickets routed through the Groq fallback.",
)
ticket_routing_errors_total = Counter(
    "ticket_routing_errors_total",
    "Tickets whose routing graph recorded an error.",
)
ticket_routing_latency_seconds = Histogram(
    "ticket_routing_latency_seconds",
    "Ticket routing latency in seconds.",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
)
ticket_auto_route_percentage = Gauge(
    "ticket_auto_route_percentage",
    "Current percentage of tickets routed without reassignment.",
)
ticket_reassignment_percentage = Gauge(
    "ticket_reassignment_percentage",
    "Current percentage of tickets that were reassigned.",
)
ticket_groq_fallback_percentage = Gauge(
    "ticket_groq_fallback_percentage",
    "Current percentage of tickets using Groq fallback.",
)
ticket_routing_p95_latency_seconds = Gauge(
    "ticket_routing_p95_latency_seconds",
    "Current p95 routing latency in seconds.",
)
ticket_drift_psi = Gauge(
    "ticket_drift_psi",
    "Current embedding and queue-distribution PSI drift values.",
    ("kind",),
)
ticket_model_info = Gauge(
    "ticket_model_info",
    "Current ticket routing model version.",
    ("version",),
)
ticket_mlop_status = Gauge(
    "ticket_mlops_status",
    "MLOps integration availability, where 1 means enabled.",
    ("integration",),
)


def record_routing(ticket: dict[str, Any]) -> None:
    ticket_routing_total.labels(
        channel=ticket.get("channel", "unknown"),
        intent=ticket.get("intent", "unknown"),
        queue=ticket.get("specialist_queue", "unassigned"),
    ).inc()
    if ticket.get("routing_decision") == "auto_route":
        ticket_auto_route_total.inc()
    if ticket.get("model_provider") == "groq":
        ticket_groq_fallback_total.inc()
    if any(item.get("status") == "error" for item in ticket.get("trace", [])):
        ticket_routing_errors_total.inc()
    latency_ms = ticket.get("routing_latency_ms")
    if latency_ms is not None:
        ticket_routing_latency_seconds.observe(float(latency_ms) / 1000)


def record_reassignment(from_queue: str, to_queue: str) -> None:
    ticket_reassignment_total.labels(from_queue=from_queue, to_queue=to_queue).inc()


def update_snapshot(metrics: dict[str, Any]) -> None:
    ticket_auto_route_percentage.set(float(metrics.get("auto_route_percentage", 0)))
    ticket_reassignment_percentage.set(float(metrics.get("bounce_reassignment_percentage", 0)))
    ticket_groq_fallback_percentage.set(float(metrics.get("groq_fallback_percentage", 0)))
    ticket_routing_p95_latency_seconds.set(float(metrics.get("p95_routing_latency_ms", 0)) / 1000)

    drift = metrics.get("drift") or {}
    ticket_drift_psi.labels(kind="embedding").set(float(drift.get("embedding_psi", 0)))
    ticket_drift_psi.labels(kind="queue").set(float(drift.get("queue_distribution_psi", 0)))
    ticket_model_info.clear()
    ticket_model_info.labels(
        version=metrics.get("current_mlflow_model_version", "unknown")
    ).set(1)
    ticket_mlop_status.labels("mlflow").set(float(bool(metrics.get("mlflow_enabled"))))
    ticket_mlop_status.labels("dvc").set(float(bool(metrics.get("dvc_enabled"))))
    ticket_mlop_status.labels("evidently").set(float(bool(metrics.get("evidently_enabled"))))
