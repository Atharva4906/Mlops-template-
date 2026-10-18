# 4. Tools Used and Integrated Tools

## 4.1 Application stack

| Tool | Role |
|---|---|
| Python | Backend language |
| FastAPI | HTTP API and WebSocket backend |
| Uvicorn | ASGI development/production server |
| React | Frontend UI |
| Vite | Frontend development and production build |
| Tailwind CSS | Frontend styling |
| Pydantic | Request validation and API models |

## 4.2 Ingestion and provider integrations

| Integration | Usage |
|---|---|
| Gmail/Google APIs | Fetch and process email messages |
| Google OAuth | Authenticate Gmail and calendar access |
| Calendar APIs | Existing calendar and event operations |
| Groq | Optional structured LLM fallback for uncertain routing |
| Supabase | Ticket persistence, queues, domains, events, and vectors |
| pgvector | Similarity search over ticket embeddings |

## 4.3 Routing and ML tools

| Tool | Usage |
|---|---|
| LangGraph | Observable routing graph and node orchestration |
| sentence-transformers | Optional BGE-small embeddings |
| NumPy | Vector handling and PSI calculations |
| scikit-learn | Local logistic regression classifier and metrics |
| joblib | Challenger model artifact persistence |
| MLflow | Experiment tracking, model logging, registry, and champion alias |
| DVC | Versioning for the resolved-ticket training dataset |
| Evidently | Optional drift provider after data readiness threshold |

## 4.4 Observability and delivery tools

| Tool | Usage |
|---|---|
| prometheus-fastapi-instrumentator | HTTP metrics |
| Prometheus | Scrapes `/metrics` and stores time series |
| Docker | Backend and frontend packaging |
| Nginx | Static frontend container server and SPA fallback |
| GitHub Actions | CI, tests, builds, and image publishing |
| GitHub Container Registry | Stores published container images |

## 4.5 External configuration

Secrets and runtime configuration belong in environment variables or the
deployment platform's secret manager. Important examples include:

```text
SUPABASE_URL
SUPABASE_KEY
GROQ_API_KEY
MLFLOW_TRACKING_URI
MLFLOW_EXPERIMENT_NAME
MLFLOW_ROUTING_MODEL_URI
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

The repository `.env` file is ignored by Git and excluded from Docker build
contexts. GitHub Actions does not use the local `.env`.

## DVC setup

The repository is initialized as a DVC project. The resolved-ticket dataset is
tracked by:

```text
nexus-backend/nexus/mlops_artifacts/resolved_tickets.jsonl.dvc
```

The dataset contents stay out of Git; the `.dvc` pointer is committed instead.
At runtime, retraining rewrites the resolved-ticket dataset and runs `dvc add`
to create an updated dataset version.

The current default remote is a local filesystem remote:

```powershell
dvc remote list
# local-storage  dvc-storage (default)
dvc push
```

The `dvc-storage/` directory is ignored by Git and is intended for the current
single-machine setup. GitHub-hosted runners cannot access that local folder,
so CI runs code validation and only pulls data when the optional
`DVC_REMOTE_URL` secret is configured.
