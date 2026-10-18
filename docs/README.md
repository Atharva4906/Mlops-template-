# Ticket Routing Agent Documentation

This folder is the project documentation set for the **Ticket Routing Agent**.
The active product ingests messages from multiple channels, classifies them,
routes them to specialist queues, persists the operational record, and
provides an MLOps lifecycle for monitoring and improving routing quality.

## Documents

1. [Project implementation](./01-project-implementation.md)
2. [Use cases and users](./02-use-cases-and-users.md)
3. [Applications and future scope](./03-applications-and-future-scope.md)
4. [Tools and integrations](./04-tools-and-integrations.md)
5. [MLOps concepts and usage](./05-mlops-concepts-and-usage.md)
6. [Complete project workflow](./06-complete-workflow.md)
7. [Project summary](./07-project-summary.md)
8. [PRD and detailed implementation](./08-prd-and-detailed-implementation.md)

## Active product boundary

The active path is ticket routing. Gmail/email ingestion, chat/webhook
ingestion, ticket operations, calendar/actions, monitoring, and MLOps are
retained. BRD generation and project-clustering code remains in the
repository for reference or legacy compatibility but is not part of the
primary ticket-routing user journey.

## Repository map

```text
nexus-backend/nexus/
  main.py                         FastAPI application and ingestion wiring
  services/ticket_api.py          Ticket endpoints and lifecycle operations
  services/ticket_pipeline.py     Public pipeline entry point
  services/hybrid_routing.py      LangGraph routing orchestration
  services/db_service.py          Supabase persistence and retrieval
  services/mlops_service.py       Drift, retraining, MLflow, DVC hooks
  services/prometheus_metrics.py  Application Prometheus metrics
  supabase_ticket_routing_migration.sql

nexus-frontend/src/
  App.jsx                         Routes and application shell
  pages/TicketQueue.jsx           Specialist queue
  pages/TicketSimulator.jsx       Routing simulator
  pages/TicketRoutingDashboard.jsx
  pages/MLOpsDashboard.jsx

.github/workflows/ci.yml          CI and GHCR image publishing
```

## Local entry points

```powershell
cd nexus-backend\nexus
python main.py

cd nexus-frontend
npm install
npm run dev
```

The backend runs on port `8000`; the Vite development server runs on port
`5173`.
