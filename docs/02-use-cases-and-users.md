# 2. Use Cases and Intended Users

## 2.1 Who the system is for

### Customer support teams

Support teams receive messages from email, chat, and webhook-connected
systems. The agent classifies each request and directs it to the correct
specialist queue.

### Support operations managers

Managers need queue volumes, reassignment rates, latency, error rates, and
drift indicators. The dashboard and Prometheus metrics provide this
operational visibility.

### Specialist agents

Specialists work from queues such as billing, fraud, account, technical, and
general support. They can update ticket status and reassign tickets when the
initial route is incorrect.

### ML engineers and MLOps engineers

MLOps users monitor routing quality, inspect drift, export resolved tickets,
train challengers, and promote models through MLflow.

### Platform and DevOps engineers

Platform users operate the FastAPI and React services, configure secrets,
monitor health, and consume the GitHub Actions container images.

## 2.2 Core use cases

### Use case A: Route a Gmail message

1. Gmail ingestion fetches a message.
2. The source identifier and thread identifier are preserved.
3. The message is converted into a ticket payload.
4. Duplicate source checks prevent repeated ticket creation.
5. The routing pipeline scrubs and classifies the message.
6. The email is linked to the created ticket.
7. The ticket appears in the appropriate specialist queue.

### Use case B: Route a webhook event

An external system posts a ticket to `POST /api/webhooks/tickets`. The same
pipeline is used regardless of channel, preserving a consistent routing
contract.

### Use case C: Route an uncertain request

If the local confidence is not high enough, the system can request a
structured Groq fallback. If confidence remains very low, the ticket is
marked for human triage rather than being presented as a confident automatic
decision.

### Use case D: Correct a route

An operator reassigns a ticket and supplies a reason. The reassignment is
recorded as an event and can receive increased training weight during
retraining.

### Use case E: Monitor production routing

Prometheus scrapes `/metrics`. Operators inspect rates, latency, errors,
fallback counts, drift, and active model information in Prometheus or the
frontend MLOps dashboard.

### Use case F: Improve the routing model

Resolved tickets are exported as labeled examples. A challenger model is
trained, evaluated with weighted F1, logged to MLflow, and made eligible for
promotion when the operator decides it is reliable.

## 2.3 Example domains

| Domain | Example request | Queue |
|---|---|---|
| Fraud | Unauthorized transaction or stolen card | `fraud-specialists` |
| Billing | Invoice, refund, payment, or charge issue | `billing-specialists` |
| Account | Login, password, verification, or access issue | `account-specialists` |
| Technical | Product defect, crash, or system failure | `technical-specialists` |
| General | Information request or unmatched support question | `general-specialists` |

## 2.4 Business value

- Less manual triage.
- Faster first assignment.
- Consistent queue ownership.
- Auditable operator corrections.
- Measurable model quality.
- Safer model changes through challenger evaluation.
- A single operational view across ingestion and routing channels.
