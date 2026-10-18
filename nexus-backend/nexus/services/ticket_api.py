"""FastAPI endpoints for the direct support routing vertical slice."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Awaitable, Callable
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.ticket_pipeline import RoutingEngine, TicketPipeline
import services.db_service as db_service
from services import mlops_service
from services import prometheus_metrics

router = APIRouter(prefix="/api", tags=["tickets"])
tickets: dict[str, dict[str, Any]] = {}
domains: dict[str, dict[str, Any]] = {
    "fraud": {"slug": "fraud", "name": "Fraud", "description": "Unauthorized transactions and abuse", "specialist_queue": "fraud-specialists", "is_active": True},
    "billing": {"slug": "billing", "name": "Billing", "description": "Payments, invoices, refunds, and charges", "specialist_queue": "billing-specialists", "is_active": True},
    "account": {"slug": "account", "name": "Account", "description": "Login, access, and verification", "specialist_queue": "account-specialists", "is_active": True},
    "technical": {"slug": "technical", "name": "Technical", "description": "Product defects and technical failures", "specialist_queue": "technical-specialists", "is_active": True},
    "general": {"slug": "general", "name": "General", "description": "Fallback support domain", "specialist_queue": "general-specialists", "is_active": True},
}
intent_domains: dict[str, str] = {intent: intent for intent in domains}
pipeline = TicketPipeline(routing=RoutingEngine(mapping=intent_domains, domains=domains))
broadcaster: Callable[[dict[str, Any]], Awaitable[None]] | None = None


class TicketWebhook(BaseModel):
    id: str | None = None
    channel: str = Field(default="email", pattern="^(email|chat|webhook)$")
    subject: str = ""
    content: str = Field(min_length=1)


class TicketStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|in_progress|resolved|escalated)$")


class TicketCreate(BaseModel):
    id: str | None = None
    channel: str = Field(default="webhook", pattern="^(email|chat|webhook)$")
    subject: str = ""
    content: str = Field(min_length=1)
    email_id: str | None = None
    thread_id: str | None = None
    sender: str | None = None
    customer_tier: str | None = None


class TicketReassignment(BaseModel):
    specialist_queue: str = Field(min_length=1)
    reason: str = ""


class TicketDomainInput(BaseModel):
    slug: str = Field(min_length=1, pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str = Field(min_length=1)
    description: str = ""
    specialist_queue: str = Field(min_length=1)
    is_active: bool = True


class TicketDomainUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    specialist_queue: str | None = None
    is_active: bool | None = None


class IntentDomainUpdate(BaseModel):
    domain: str = Field(min_length=1)


def set_broadcaster(callback: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
    global broadcaster
    broadcaster = callback


async def _broadcast(message: dict[str, Any]) -> None:
    if broadcaster:
        await broadcaster(message)


def route_ingested_source(payload: dict[str, Any]) -> dict[str, Any]:
    """Classify an ingested source without changing its source-system contract."""
    source_id = payload.get("source_id") or payload.get("id")
    if source_id:
        duplicate = next((ticket for ticket in tickets.values() if ticket.get("source_id") == source_id), None)
        if duplicate:
            return duplicate
        try:
            stored = db_service.get_ticket_by_source(source_id)
            if stored:
                duplicate = _stored_ticket(stored)
                tickets[duplicate["id"]] = duplicate
                return duplicate
        except Exception as exc:
            print(f"[Tickets] Unable to check persisted source duplicate: {exc}")

    ticket = pipeline.process({
        "id": source_id,
        "channel": payload.get("channel", "email"),
        "subject": payload.get("subject", ""),
        "content": payload.get("content") or payload.get("body", ""),
    })
    ticket["id"] = source_id or str(uuid4())
    ticket["source_id"] = source_id
    ticket["thread_id"] = payload.get("thread_id")
    ticket["email_id"] = payload.get("email_id")
    ticket["was_reassigned"] = False
    tickets[ticket["id"]] = ticket
    prometheus_metrics.record_routing(ticket)
    _persist_ticket(ticket)
    return ticket


def _persist_ticket(ticket: dict[str, Any]) -> None:
    try:
        stored = db_service.upsert_ticket(ticket)
        ticket["database_id"] = stored.get("id")
        if ticket.get("email_id"):
            db_service.link_email_to_ticket(ticket["email_id"], stored["id"])
    except Exception as exc:
        print(f"[Tickets] Persistence unavailable; retaining local ticket: {exc}")


def _stored_ticket(row: dict[str, Any]) -> dict[str, Any]:
    """Map the Supabase row shape back to the frontend ticket contract."""
    predictions = row.get("ticket_predictions") or []
    prediction = predictions[0] if isinstance(predictions, list) and predictions else {}
    return {
        "id": row.get("source_id") or row.get("id"),
        "database_id": row.get("id"),
        "source_id": row.get("source_id"),
        "thread_id": row.get("thread_id"),
        "channel": row.get("source_channel", "email"),
        "subject": row.get("subject_scrubbed", ""),
        "content": row.get("content_scrubbed", ""),
        "intent": prediction.get("intent", "general"),
        "sentiment": prediction.get("sentiment", "neutral"),
        "confidence": float(prediction.get("confidence") or 0),
        "domain": (row.get("ticket_domains") or {}).get("slug", "general"),
        "domain_name": (row.get("ticket_domains") or {}).get("name", "General"),
        "specialist_queue": (row.get("specialist_queues") or {}).get("slug", "unassigned"),
        "explanation": prediction.get("explanation", []),
        "status": row.get("status", "open"),
        "was_reassigned": row.get("was_reassigned", False),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _find_ticket(ticket_id: str) -> dict[str, Any] | None:
    ticket = tickets.get(ticket_id)
    if ticket:
        return ticket
    try:
        rows = db_service.get_tickets()
    except Exception as exc:
        print(f"[Tickets] Unable to read persisted tickets: {exc}")
        return None
    for row in rows:
        candidate = _stored_ticket(row)
        tickets[candidate["id"]] = candidate
    return tickets.get(ticket_id)


@router.post("/webhooks/tickets", status_code=202)
async def ingest_ticket(payload: TicketWebhook) -> dict[str, Any]:
    ticket_id = payload.id or str(uuid4())
    if ticket_id in tickets:
        return {"status": "duplicate", "ticket": tickets[ticket_id]}

    ticket = route_ingested_source(payload.model_dump())
    ticket["id"] = ticket_id
    tickets[ticket_id] = ticket
    await _broadcast({"type": "ticket_created", "payload": ticket})
    return {"status": "accepted", "ticket": ticket}


@router.post("/v1/tickets", status_code=202)
async def create_ticket(payload: TicketCreate) -> dict[str, Any]:
    ticket = route_ingested_source(payload.model_dump())
    await _broadcast({"type": "ticket_created", "payload": ticket})
    return {"status": "accepted", "ticket": ticket}


@router.get("/tickets")
async def list_tickets(
    specialist_queue: str | None = Query(default=None),
    status: str | None = Query(default=None),
    intent: str | None = Query(default=None),
    domain: str | None = Query(default=None),
) -> dict[str, Any]:
    try:
        result = [_stored_ticket(row) for row in db_service.get_tickets()]
        tickets.update({item["id"]: item for item in result})
    except Exception as exc:
        print(f"[Tickets] Using local ticket cache: {exc}")
        result = list(tickets.values())
    if specialist_queue:
        result = [item for item in result if item["specialist_queue"] == specialist_queue]
    if status:
        result = [item for item in result if item["status"] == status]
    if intent:
        result = [item for item in result if item["intent"] == intent]
    if domain:
        result = [item for item in result if item.get("domain") == domain]
    result.sort(key=lambda item: item["created_at"], reverse=True)
    return {"tickets": result, "count": len(result)}


@router.get("/v1/tickets")
async def list_tickets_v1(
    specialist_queue: str | None = Query(default=None),
    status: str | None = Query(default=None),
    intent: str | None = Query(default=None),
    domain: str | None = Query(default=None),
) -> dict[str, Any]:
    return await list_tickets(
        specialist_queue=specialist_queue,
        status=status,
        intent=intent,
        domain=domain,
    )


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str) -> dict[str, Any]:
    ticket = _find_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"ticket": ticket}


@router.get("/v1/tickets/{ticket_id}")
async def get_ticket_v1(ticket_id: str) -> dict[str, Any]:
    return await get_ticket(ticket_id)


@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, update: TicketStatusUpdate) -> dict[str, Any]:
    ticket = _find_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket["status"] = update.status
    ticket["updated_at"] = datetime.now(timezone.utc).isoformat()
    if ticket.get("database_id"):
        try:
            db_service.update_ticket(ticket["database_id"], {"status": update.status})
        except Exception as exc:
            print(f"[Tickets] Status persistence failed: {exc}")
    await _broadcast({"type": "ticket_updated", "payload": ticket})
    return {"ticket": ticket}


async def _reassign_ticket(ticket_id: str, update: TicketReassignment) -> dict[str, Any]:
    ticket = _find_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    previous_queue = ticket["specialist_queue"]
    ticket["specialist_queue"] = update.specialist_queue
    ticket["was_reassigned"] = previous_queue != update.specialist_queue
    ticket["final_resolved_queue"] = update.specialist_queue
    ticket["updated_at"] = datetime.now(timezone.utc).isoformat()
    if ticket["was_reassigned"]:
        prometheus_metrics.record_reassignment(previous_queue, update.specialist_queue)
    if ticket.get("database_id"):
        try:
            db_service.update_ticket_queue(ticket["database_id"], update.specialist_queue)
            db_service.add_ticket_event(ticket["database_id"], "reassigned", {
                "from_queue": previous_queue,
                "to_queue": update.specialist_queue,
                "reason": update.reason,
            })
        except Exception as exc:
            print(f"[Tickets] Reassignment persistence failed: {exc}")
    await _broadcast({"type": "ticket_updated", "payload": ticket})
    return {"ticket": ticket}


@router.patch("/v1/tickets/{ticket_id}/reassign")
async def reassign_ticket_v1(ticket_id: str, update: TicketReassignment) -> dict[str, Any]:
    return await _reassign_ticket(ticket_id, update)


@router.patch("/tickets/{ticket_id}/reassign")
async def reassign_ticket(ticket_id: str, update: TicketReassignment) -> dict[str, Any]:
    return await _reassign_ticket(ticket_id, update)


@router.get("/queues")
async def list_queues() -> dict[str, Any]:
    queues = sorted({domain["specialist_queue"] for domain in domains.values() if domain["is_active"]})
    return {"queues": queues}


@router.get("/ticket-domains")
async def list_ticket_domains(include_inactive: bool = Query(default=False)) -> dict[str, Any]:
    values = list(domains.values())
    if not include_inactive:
        values = [domain for domain in values if domain["is_active"]]
    return {"domains": sorted(values, key=lambda domain: domain["name"].lower())}


@router.post("/ticket-domains", status_code=201)
async def create_ticket_domain(payload: TicketDomainInput) -> dict[str, Any]:
    if payload.slug in domains:
        raise HTTPException(status_code=409, detail="Ticket domain already exists")
    domain = payload.model_dump()
    domains[payload.slug] = domain
    return {"domain": domain}


@router.patch("/ticket-domains/{domain_slug}")
async def update_ticket_domain(domain_slug: str, payload: TicketDomainUpdate) -> dict[str, Any]:
    domain = domains.get(domain_slug)
    if not domain:
        raise HTTPException(status_code=404, detail="Ticket domain not found")
    domain.update({key: value for key, value in payload.model_dump().items() if value is not None})
    return {"domain": domain}


@router.delete("/ticket-domains/{domain_slug}")
async def deactivate_ticket_domain(domain_slug: str) -> dict[str, Any]:
    domain = domains.get(domain_slug)
    if not domain:
        raise HTTPException(status_code=404, detail="Ticket domain not found")
    domain["is_active"] = False
    if intent_domains.get(domain_slug) == domain_slug:
        intent_domains[domain_slug] = "general"
    return {"domain": domain}


@router.get("/ticket-domains/intents")
async def list_intent_domains() -> dict[str, Any]:
    return {"routes": intent_domains}


@router.put("/ticket-domains/intents/{intent}")
async def update_intent_domain(intent: str, payload: IntentDomainUpdate) -> dict[str, Any]:
    if payload.domain not in domains or not domains[payload.domain]["is_active"]:
        raise HTTPException(status_code=400, detail="Active ticket domain not found")
    intent_domains[intent] = payload.domain
    return {"intent": intent, "domain": payload.domain}


@router.get("/routing/metrics")
async def routing_metrics() -> dict[str, Any]:
    values = list(tickets.values())
    by_intent: dict[str, int] = {}
    by_queue: dict[str, int] = {}
    for ticket in values:
        by_intent[ticket["intent"]] = by_intent.get(ticket["intent"], 0) + 1
        by_queue[ticket["specialist_queue"]] = by_queue.get(ticket["specialist_queue"], 0) + 1
    return {"total_tickets": len(values), "by_intent": by_intent, "by_queue": by_queue}


@router.get("/v1/mlops/metrics")
async def mlops_metrics() -> dict[str, Any]:
    values = list(tickets.values())
    metrics = mlops_service.collect_metrics(values)
    prometheus_metrics.update_snapshot(metrics)
    return metrics


@router.post("/v1/mlops/evaluate-drift", status_code=202)
async def evaluate_drift() -> dict[str, Any]:
    result = mlops_service.evaluate_drift(list(tickets.values()))
    metrics = mlops_service.collect_metrics(list(tickets.values()))
    metrics["drift"] = result
    prometheus_metrics.update_snapshot(metrics)
    return result


@router.post("/v1/mlops/trigger-retrain", status_code=202)
async def trigger_retrain() -> dict[str, Any]:
    return mlops_service.retrain(list(tickets.values()))


@router.post("/v1/mlops/promote", status_code=200)
async def promote_model() -> dict[str, Any]:
    return mlops_service.promote_challenger()
