# 5. MLOps Concepts and Where They Are Used

## 5.1 Experiment tracking

MLflow tracks retraining runs under the configured experiment, including
model artifacts and evaluation values such as weighted F1. This creates a
record of which data and model version produced a challenger.

Implemented in:

- `services/mlops_service.py`
- `MLFLOW_TRACKING_URI`
- `MLFLOW_EXPERIMENT_NAME`

## 5.2 Model registry and promotion

The retraining flow registers a model and attempts to assign a `Champion`
alias. The routing service can load the configured champion URI. If the
registry is unavailable or the model does not exist, the local classifier
remains available.

Typical modern URI:

```text
models:/ticket-routing@Champion
```

## 5.3 Challenger/champion deployment

- **Champion:** currently selected routing model.
- **Challenger:** newly trained model evaluated against resolved-ticket data.
- **Promotion:** explicit lifecycle action that changes the selected model.
- **Hot reload:** the routing classifier can reload a promoted artifact without
  changing the ticket API contract.

The system does not treat a small training result as automatically reliable.
For example, a three-row training run is technically valid but should not be
considered production-quality evidence.

## 5.4 Data quality and labeling

Resolved tickets provide supervised labels. Reassigned tickets are valuable
feedback because an operator corrected the route. They receive a `2.5x`
training weight during challenger training.

The minimum useful dataset should contain multiple examples across at least
two intent classes. One-class data is blocked because logistic regression
cannot learn a meaningful classifier from a single class.

## 5.5 Drift monitoring

The current drift service calculates:

- Confidence-signal PSI.
- Queue-distribution PSI.
- An embedding signal based on the first embedding component.

The baseline and current dataset must meet `MLOPS_MIN_DRIFT_SAMPLES`, which
defaults to `10`. Before that point, the result is:

```text
waiting_for_data
```

This prevents unstable drift conclusions from tiny samples.

## 5.6 Evidently

Evidently is an optional integration in the same backend environment. Its
availability is reported separately from readiness:

- `evidently_enabled`: package import is available.
- `evidently_ready`: enough baseline and current samples exist.
- `drift_ready`: enough data exists for evaluation.

Local PSI remains the fallback when Evidently is unavailable. Full Evidently
report artifact generation is a future lifecycle enhancement.

## 5.7 Prometheus observability

The backend exposes `/metrics` for Prometheus. Custom metrics include:

- `ticket_routing_total`
- `ticket_auto_route_total`
- `ticket_reassignment_total`
- `ticket_groq_fallback_total`
- `ticket_routing_errors_total`
- `ticket_routing_latency_seconds`
- `ticket_auto_route_percentage`
- `ticket_reassignment_percentage`
- `ticket_groq_fallback_percentage`
- `ticket_routing_p95_latency_seconds`
- `ticket_drift_psi`
- `ticket_model_info`
- `ticket_mlops_status`

Prometheus answers operational questions such as:

- Are requests reaching the backend?
- Is routing latency increasing?
- Are reassignment rates increasing?
- Is Groq fallback being used too often?
- Is drift above the configured threshold?

## 5.8 Dataset versioning with DVC

DVC is initialized at the repository root and owns the resolved-ticket
training dataset. Git stores the small pointer file while DVC storage holds
the dataset contents. During retraining, the dataset is exported and
versioned with `dvc add`.

The MLOps metrics endpoint reports DVC as enabled only when both the DVC
repository metadata and the DVC Python package are available. Retraining
returns a DVC status object so an operator can see whether the dataset was
versioned successfully.

The current DVC remote is a local `dvc-storage/` directory, which is suitable
for the present single-machine workflow. The directory is ignored by Git.
GitHub-hosted runners cannot access this workstation folder, so CI performs
code validation and only pulls a dataset when the optional `DVC_REMOTE_URL`
secret is configured.

## 5.9 CI/CD and reproducibility

GitHub Actions provides repeatable backend tests and frontend builds. On
successful pushes to `main`, Docker images are published with both `latest`
and commit-SHA tags:

```text
ghcr.io/<owner>/ticket-routing-agent-backend
ghcr.io/<owner>/ticket-routing-agent-frontend
```

The SHA tag provides a reproducible deployment reference.
