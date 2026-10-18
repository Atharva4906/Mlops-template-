# 1. Project Implementation

## 1.1 Objective

The project implements an operational ticket-routing platform that converts
incoming customer or business messages into structured tickets. Each ticket is
scrubbed, classified, assigned to a domain and specialist queue, recorded for
auditability, and exposed to operators through a React dashboard.

## 1.2 Implemented capabilities

- Gmail/email ingestion with source and thread identifiers.
- Chat and webhook ticket ingestion.
- PII scrubbing before routing and persistence.
- Deterministic intent/domain classification for stable known patterns.
- Embedding-based routing signal with a 384-dimensional contract.
- Local logistic-regression fallback classifier.
- Optional MLflow champion model loading.
- Optional Groq structured fallback for uncertain decisions.
- Confidence-based auto-route, fallback, and human-triage decisions.
- Duplicate-source protection for idempotent ingestion.
- Supabase persistence for tickets, predictions, events, emails, and embeddings.
- Queue filtering, status changes, reassignment, and reassignment feedback.
- WebSocket broadcast for newly created tickets.
- Prometheus HTTP and application metrics.
- Drift evaluation using local PSI, with data-gated Evidently readiness.
- Resolved-ticket export and challenger retraining.
- MLflow experiment/model logging and champion promotion hooks.
- React dashboard, ticket queue, simulator, domain management, and MLOps page.
- GitHub Actions CI and Docker image publishing to GHCR.

## 1.3 Backend implementation

The FastAPI application is defined in `nexus-backend/nexus/main.py`. The
ticket API is mounted from `services/ticket_api.py`.

Important endpoint groups include:

| Endpoint | Purpose |
|---|---|
| `POST /api/webhooks/tickets` | Accept webhook-style tickets |
| `POST /api/v1/tickets` | Create a ticket directly |
| `GET /api/tickets` | List and filter tickets |
| `PATCH /api/tickets/{id}/status` | Update ticket lifecycle status |
| `POST /api/tickets/{id}/reassign` | Reassign to another specialist queue |
| `GET /api/ticket-domains` | List routing domains |
| `GET /api/v1/mlops/metrics` | Return routing/MLOps metrics |
| `POST /api/v1/mlops/evaluate-drift` | Evaluate drift |
| `POST /api/v1/mlops/trigger-retrain` | Train a challenger model |
| `POST /api/v1/mlops/promote` | Promote a challenger model |
| `GET /metrics` | Prometheus scrape endpoint |

## 1.4 Frontend implementation

The frontend is a React/Vite application. The main routes are registered in
`nexus-frontend/src/App.jsx`.

- Dashboard: operational routing overview.
- Ticket queue: specialist work management.
- Ticket simulator: test routing against sample messages.
- Inbox: email-oriented ingestion and routing.
- Ticket domains: domain and queue configuration.
- MLOps: drift, model, token, latency, and integration status.
- Metrics: operational metrics view.

## 1.5 Persistence model

The SQL migration in
`nexus-backend/nexus/supabase_ticket_routing_migration.sql` defines the
ticket-routing database additions:

- `tickets`
- `ticket_predictions`
- `ticket_events`
- `ticket_embeddings`
- Queue and domain relationships
- Email-to-ticket linkage
- pgvector similarity search function and indexes

The normalized model keeps the ticket record, prediction record, and audit
events separate. This allows a ticket to have a lifecycle independent of a
single prediction.

## 1.6 Reliability behavior

External integrations are optional at runtime. If Supabase, MLflow, Groq,
sentence-transformers, DVC, or Evidently is unavailable, the application
uses a local fallback where one is implemented and reports the integration
state rather than silently presenting it as active.

## 1.7 Validation

Current validation commands:

```powershell
cd nexus-backend\nexus
python -m unittest test_ticket_routing -v
python -m py_compile main.py services\*.py

cd nexus-frontend
npm run build
```

The GitHub Actions workflow repeats the backend and frontend validation using
Python 3.11 and Node.js 20.
