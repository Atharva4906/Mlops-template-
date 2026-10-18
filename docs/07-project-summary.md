# 7. Whole Project Summary

## Short explanation

Ticket Routing Agent is an AI-assisted, multi-channel support operations
platform. It receives messages from email, chat, and webhooks, converts them
into tickets, removes sensitive information, predicts the correct support
domain, and sends each ticket to a specialist queue.

The system is intentionally hybrid. Deterministic rules provide stable
behavior for known intents. Embeddings, similarity retrieval, a local
classifier, an optional MLflow champion, and an optional Groq fallback provide
more flexible routing for varied messages. Confidence thresholds prevent the
system from pretending uncertain decisions are reliable.

Tickets are persisted with their predictions, embeddings, and lifecycle
events. Operators can resolve or reassign tickets. Those corrections become
valuable labeled feedback for model improvement.

The MLOps layer monitors routing volume, latency, reassignment, errors, token
usage, model state, and drift. MLflow manages experiments and candidate model
versions. Prometheus provides operational time-series metrics. Evidently is
data-gated so it only becomes ready after enough baseline and current data
exists. GitHub Actions verifies code and publishes reproducible Docker images.

## One-line architecture

```text
Channels -> Ingestion -> Scrubbing -> Hybrid Routing -> Queue -> Operator Feedback -> MLOps
```

## What is complete

- Core ticket-routing vertical slice.
- Gmail-to-ticket linkage.
- Webhook and direct ticket APIs.
- Queue and domain management.
- Hybrid routing and fallback behavior.
- Supabase ticket persistence.
- Prometheus metrics and dashboard.
- DVC-managed resolved-ticket dataset versioning.
- MLflow retraining and promotion hooks.
- Data-gated drift monitoring.
- React MLOps dashboard.
- GitHub Actions CI/CD and GHCR publishing.

## What remains

- Production authentication and role-based authorization for sensitive
  operations.
- Full Evidently report artifacts.
- Grafana dashboards and alert rules.
- More representative labeled data.
- Durable metric aggregation after process restarts.
- Production deployment infrastructure for the published images.
- More extensive integration and end-to-end tests.
