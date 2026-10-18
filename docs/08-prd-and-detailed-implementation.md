# 8. Product Requirements Document and Detailed Implementation

## 8.1 Product definition

### Product name

Ticket Routing Agent

### Problem statement

Support requests arrive through different channels and are often routed
manually. Manual triage creates delays, inconsistent queue ownership, and
limited feedback for improving the routing process.

### Product vision

Provide a reliable, observable, and continuously improvable routing layer that
converts incoming messages into actionable specialist tickets.

## 8.2 Goals

1. Ingest messages from multiple channels.
2. Route common support intents automatically.
3. Preserve source identity and prevent duplicate tickets.
4. Give operators visibility and correction controls.
5. Measure routing reliability and latency.
6. Improve models from resolved and reassigned tickets.
7. Deliver changes through repeatable CI/CD.

## 8.3 Non-goals

- Replacing human specialists for all support decisions.
- Automatically sending high-risk customer responses without approval.
- Treating a small training dataset as production-grade evidence.
- Making BRD generation the primary application workflow.

## 8.4 Functional requirements

### FR-1: Ingestion

The system shall accept email, chat, and webhook payloads. Email payloads
shall retain message and thread identifiers.

### FR-2: Validation

API payloads shall be validated with Pydantic models. Unsupported channels and
invalid lifecycle statuses shall be rejected.

### FR-3: Privacy

Sensitive values shall be scrubbed before the routing result is persisted or
displayed to operators.

### FR-4: Routing

The system shall classify requests into configured domains and specialist
queues. The initial domains include fraud, billing, account, technical, and
general.

### FR-5: Confidence handling

The system shall distinguish high-confidence routes from uncertain routes.
Uncertain routes may use an LLM fallback or human triage.

### FR-6: Idempotency

Repeated source IDs shall not create duplicate tickets.

### FR-7: Persistence

Tickets, predictions, embeddings, email links, and lifecycle events shall be
stored when Supabase is configured.

### FR-8: Operations

Operators shall list, filter, update, resolve, and reassign tickets.

### FR-9: Monitoring

The service shall expose Prometheus-compatible application metrics and an
MLOps JSON summary.

### FR-10: Model lifecycle

The service shall export resolved tickets, train challengers, calculate
weighted F1, log/register models, and support explicit promotion.

### FR-11: Delivery

Pull requests and pushes shall run backend and frontend validation. Successful
pushes to `main` shall publish versioned container images.

## 8.5 Non-functional requirements

### Reliability

Optional integrations must fail gracefully into documented local behavior
where possible. Ingestion should not require MLflow or Evidently to be
installed.

### Observability

Routing latency, errors, fallback rates, reassignment, drift, and model state
must be measurable.

### Security

Secrets must not be committed. Runtime secrets must be supplied through
environment configuration or deployment secret stores.

### Maintainability

Routing, persistence, MLOps, metrics, and API concerns should remain separated
into services.

### Reproducibility

Dependencies should be compatible and CI should use pinned runtime versions.
Container images should receive commit-SHA tags.

## 8.6 Technical design

### Request path

`main.py` receives or forwards ingestion events. `ticket_api.py` exposes
ticket endpoints and calls `route_ingested_source`. The public pipeline
delegates routing to `hybrid_routing.py`.

### Routing graph

The routing graph contains stages for:

1. Scrub.
2. Embed.
3. Retrieve similar resolved tickets.
4. Classify.
5. Optional Groq fallback.
6. Decide and produce a structured result.

### Data contracts

A routed ticket contains fields such as:

```json
{
  "id": "source-or-generated-id",
  "channel": "email",
  "subject": "scrubbed subject",
  "content": "scrubbed content",
  "intent": "billing",
  "domain": "billing",
  "specialist_queue": "billing-specialists",
  "confidence": 0.91,
  "status": "open",
  "was_reassigned": false
}
```

The exact response may contain additional trace, provider, embedding, and
timestamp fields.

### MLOps state

`mlops_service.py` stores local state and artifacts under
`nexus-backend/nexus/mlops_artifacts/` unless the deployment configuration
routes artifacts elsewhere.

## 8.7 Acceptance criteria

- A valid email/webhook creates one ticket.
- Repeating the same source ID returns a duplicate/existing result.
- Known fraud, billing, account, technical, and general examples route to the
  expected domains.
- A reassignment is recorded and visible in metrics.
- `/metrics` returns Prometheus text format.
- `/api/v1/mlops/metrics` returns routing and integration state.
- Drift reports `waiting_for_data` before the configured sample threshold.
- Retraining blocks when fewer than two intent classes are available.
- Backend tests pass in CI.
- Frontend production build passes in CI.
- Pushes to `main` publish valid GHCR images.

## 8.8 Implementation checklist

- [x] FastAPI backend.
- [x] React/Vite frontend.
- [x] Email, chat, and webhook ingestion paths.
- [x] Ticket API and queue UI.
- [x] PII scrubbing.
- [x] Hybrid LangGraph routing.
- [x] Supabase persistence contract.
- [x] Prometheus instrumentation.
- [x] MLflow integration hooks.
- [x] DVC dataset versioning for resolved tickets.
- [x] Challenger retraining.
- [x] Data-gated drift behavior.
- [x] MLOps dashboard.
- [x] GitHub Actions CI.
- [x] Docker image publishing to GHCR.
- [ ] Production host deployment of GHCR images.
- [ ] Full Evidently report artifact generation.
- [ ] Grafana dashboards and alerting.
- [ ] Authentication/authorization for MLOps actions.
