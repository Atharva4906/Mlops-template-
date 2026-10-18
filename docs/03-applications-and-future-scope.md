# 3. Applications and Future Scope

## 3.1 Current applications

### Omnichannel support desks

The system can consolidate email, chat, and webhook requests into a common
ticket contract and route them using the same policy.

### SaaS customer support

Queues can represent product areas, subscription/billing groups, technical
support, or account operations.

### Internal IT service desks

Domains can be adapted to access requests, incidents, hardware, software, and
security operations.

### Financial and ecommerce operations

Fraud, charge, refund, account, and order-related queues can be separated
with an audit trail for reassignment.

### ML-enabled support operations

The MLOps lifecycle supports teams that need to monitor model behavior and
retrain from resolved cases.

## 3.2 Near-term improvements

1. Add authenticated and role-protected MLOps operations.
2. Persist historical metric aggregates instead of relying mainly on the
   in-memory ticket cache after restart.
3. Add full Evidently HTML/JSON report generation after the configured sample
   threshold is met.
4. Add Grafana dashboards and Prometheus alert rules.
5. Add more routing regression and lifecycle tests.
6. Add production container orchestration and health checks.
7. Add dead-letter handling and retry policies for failed ingestion.
8. Improve frontend API base URL configuration for container deployments.

## 3.3 Medium-term improvements

- Active learning from low-confidence and reassigned tickets.
- Multi-label classification for tickets spanning multiple domains.
- SLA-aware prioritization and escalation.
- Queue capacity and workload-aware routing.
- Human approval workflows for sensitive or high-risk domains.
- Full vector-distribution drift rather than a first-component embedding
  signal.
- Model registry governance, approval gates, and rollback.
- Distributed background workers for high-volume ingestion.
- Tenant isolation and organization-level configuration.

## 3.4 Long-term possibilities

- Multilingual routing.
- Voice and transcript ingestion.
- Knowledge-base retrieval and suggested responses.
- Agent-assist response drafting with approval.
- Cost-aware model selection.
- Online feature stores and feature lineage.
- Automated canary model evaluation.
- Event-driven architecture using a queue or stream platform.

## 3.5 Product boundaries

BRD generation is not part of the active ticket-routing product scope. It may
remain as legacy reference code, but future product development should
prioritize ingestion, routing, queues, operator workflows, reliability, and
MLOps governance.
