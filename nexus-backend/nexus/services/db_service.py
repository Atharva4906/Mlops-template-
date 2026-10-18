import os
from supabase import create_client, Client
from postgrest.exceptions import APIError
from typing import Any, List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

URL: str = os.getenv("SUPABASE_URL", "")
KEY: str = os.getenv("SUPABASE_KEY", "")
ALLOW_DEMO_CONTEXT = os.getenv("ALLOW_DEMO_CONTEXT", "false").lower() in ("1", "true", "yes")
TRAINING_HINTS = ("enron", "ami", "sample", "dataset")

_supabase: Optional[Client] = None

def get_db() -> Client:
    global _supabase
    if _supabase is None:
        if not URL or not KEY or "YOUR_SUPABASE" in URL:
            print("[DB] WARNING: Supabase credentials not set in .env. Persistence will fail.")
            raise RuntimeError("Missing Supabase credentials")
        _supabase = create_client(URL, KEY)
    return _supabase


# --- Ticket routing ---
def upsert_ticket(ticket: Dict[str, Any]) -> Dict[str, Any]:
    """Persist a scrubbed routed ticket and its current prediction."""
    db = get_db()
    queue_rows = db.table("specialist_queues").select("id,slug").eq("slug", ticket.get("specialist_queue", "")).limit(1).execute().data or []
    domain_rows = db.table("ticket_domains").select("id,slug").eq("slug", ticket.get("domain", "general")).limit(1).execute().data or []
    record = {
        "source_channel": ticket.get("channel", "email"),
        "source_id": ticket.get("source_id") or ticket.get("id"),
        "thread_id": ticket.get("thread_id"),
        "subject_scrubbed": ticket.get("subject", ""),
        "content_scrubbed": ticket.get("content", ""),
        "pii_scrubbed": True,
        "status": ticket.get("status", "open"),
        "queue_id": queue_rows[0]["id"] if queue_rows else None,
        "domain_id": domain_rows[0]["id"] if domain_rows else None,
    }
    source_id = record["source_id"]
    query = db.table("tickets")
    if source_id:
        existing = query.select("*").eq("source_id", source_id).limit(1).execute().data or []
        if existing:
            result = db.table("tickets").update(record).eq("id", existing[0]["id"]).execute()
            stored = (result.data or [existing[0]])[0]
        else:
            result = db.table("tickets").insert(record).execute()
            stored = (result.data or [record])[0]
    else:
        result = db.table("tickets").insert(record).execute()
        stored = (result.data or [record])[0]
    if stored.get("id"):
        import hashlib

        text_hash = hashlib.sha256(
            f"{record['subject_scrubbed']}\n{record['content_scrubbed']}".encode("utf-8")
        ).hexdigest()
        try:
            save_ticket_embedding(stored["id"], ticket.get("embedding", []), text_hash)
        except (APIError, RuntimeError, ValueError, TypeError) as exc:
            print(f"[DB] Vector persistence unavailable; continuing without embedding: {exc}")
        db.table("ticket_predictions").update({"is_current": False}).eq("ticket_id", stored["id"]).execute()
        db.table("ticket_predictions").insert({
            "ticket_id": stored["id"],
            "intent": ticket.get("intent", "general"),
            "sentiment": ticket.get("sentiment", "neutral"),
            "confidence": ticket.get("confidence", 0),
            "explanation": ticket.get("explanation", []),
            "provider": ticket.get("model_provider", "local"),
            "model_version": ticket.get("model_version"),
            "latency_ms": ticket.get("routing_latency_ms"),
        }).execute()
    return stored


def link_email_to_ticket(email_id: str, ticket_id: str) -> None:
    db = get_db()
    result = db.table("emails").update({"ticket_id": ticket_id}).eq("id", email_id).execute()
    if not result.data:
        raise ValueError(f"Email {email_id} not found or not updated")


def get_tickets() -> List[Dict[str, Any]]:
    db = get_db()
    result = db.table("tickets").select("*,specialist_queues(slug,name),ticket_domains(slug,name),ticket_predictions!inner(intent,sentiment,confidence,explanation,is_current)").eq("ticket_predictions.is_current", True).order("created_at", desc=True).execute()
    return result.data or []


def get_ticket_by_source(source_id: str) -> Dict[str, Any] | None:
    db = get_db()
    result = (
        db.table("tickets")
        .select("*,specialist_queues(slug,name),ticket_domains(slug,name),ticket_predictions!inner(intent,sentiment,confidence,explanation,is_current)")
        .eq("source_id", source_id)
        .eq("ticket_predictions.is_current", True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def get_resolved_tickets() -> List[Dict[str, Any]]:
    db = get_db()
    result = db.table("tickets").select(
        "id,subject_scrubbed,content_scrubbed,status,queue_id,domain_id,updated_at,"
        "specialist_queues(slug),ticket_predictions!inner(intent,is_current)"
    ).eq("status", "resolved").eq("ticket_predictions.is_current", True).limit(10000).execute()
    rows = result.data or []
    for row in rows:
        prediction = (row.get("ticket_predictions") or [{}])[0]
        queue = row.get("specialist_queues") or {}
        row["intent"] = prediction.get("intent", "general")
        row["queue"] = queue.get("slug", "general-specialists")
    return rows


def save_ticket_embedding(ticket_id: str, embedding: List[float], text_hash: str, outage_key: str | None = None) -> None:
    db = get_db()
    db.table("ticket_embeddings").upsert({
        "ticket_id": ticket_id,
        "embedding": embedding,
        "text_hash": text_hash,
        "outage_key": outage_key,
    }).execute()


def search_ticket_embeddings(
    embedding: List[float],
    match_count: int = 3,
    only_resolved: bool = False,
    match_threshold: float = 0.65,
) -> List[Dict[str, Any]]:
    db = get_db()
    result = db.rpc("match_ticket_embeddings", {
        "query_embedding": embedding,
        "match_threshold": match_threshold,
        "match_count": match_count,
        "only_resolved": only_resolved,
    }).execute()
    return result.data or []


def update_ticket(ticket_id: str, changes: Dict[str, Any]) -> Dict[str, Any]:
    db = get_db()
    result = db.table("tickets").update(changes).eq("id", ticket_id).execute()
    if not result.data:
        raise ValueError(f"Ticket {ticket_id} not found")
    return result.data[0]


def update_ticket_queue(ticket_id: str, queue_slug: str) -> Dict[str, Any]:
    db = get_db()
    queues = db.table("specialist_queues").select("id").eq("slug", queue_slug).limit(1).execute().data or []
    if not queues:
        raise ValueError(f"Specialist queue {queue_slug} not found")
    return update_ticket(ticket_id, {"queue_id": queues[0]["id"]})


def add_ticket_event(ticket_id: str, event_type: str, metadata: Dict[str, Any] | None = None) -> None:
    db = get_db()
    db.table("ticket_events").insert({
        "ticket_id": ticket_id,
        "event_type": event_type,
        "metadata": metadata or {},
    }).execute()

# --- Projects ---
def create_project(name: str, description: str = "") -> Dict:
    db = get_db()
    res = db.table("projects").insert({"name": name, "description": description, "status": "active"}).execute()
    return res.data[0] if res.data else {}

def get_projects() -> List[Dict]:
    db = get_db()
    res = db.table("projects").select("*").order("created_at", desc=True).execute()
    return res.data or []

def get_project_by_id(project_id: str) -> Dict:
    db = get_db()
    res = db.table("projects").select("*").eq("id", project_id).single().execute()
    return res.data or {}

def get_project_by_name(name: str) -> Optional[Dict]:
    db = get_db()
    res = db.table("projects").select("*").eq("name", name).limit(1).execute()
    return (res.data or [None])[0]

def delete_project(project_id: str):
    """Remove project and detach related records."""
    db = get_db()
    db.table("documents").delete().eq("project_id", project_id).execute()
    db.table("brds").delete().eq("project_id", project_id).execute()
    db.table("emails").update({"project_id": None}).eq("project_id", project_id).execute()
    db.table("projects").delete().eq("id", project_id).execute()

# --- Emails ---
def upsert_emails(emails: List[Dict]):
    """Sync a batch of Gmail messages to the DB."""
    db = get_db()
    data = []
    for em in emails:
        data.append({
            "id": em["id"],
            "thread_id": em.get("thread_id"),
            "sender": em.get("sender"),
            "subject": em.get("subject"),
            "body": em.get("body"),
            "received_at": em.get("received_at") or em.get("date"),
            "is_processed": False
        })
    if data:
        return db.table("emails").upsert(data, on_conflict="id").execute()

def get_unassigned_emails() -> List[Dict]:
    db = get_db()
    res = db.table("emails").select("*").is_("project_id", "null").order("received_at", desc=True).execute()
    return res.data or []

def link_email_to_project(email_id: str, project_id: str, email_data: Optional[Dict] = None):
    """Attach an email to a project, inserting the email row if it does not exist."""
    db = get_db()
    res = db.table("emails").update({"project_id": project_id}).eq("id", email_id).execute()
    data = res.data or []
    if data:
        return data[0]

    if email_data:
        # Upsert full record to avoid null rows
        record = {
            "id": email_id,
            "thread_id": email_data.get("thread_id"),
            "sender": email_data.get("sender"),
            "subject": email_data.get("subject"),
            "body": email_data.get("body"),
            "project_id": project_id,
            "received_at": email_data.get("received_at") or email_data.get("date"),
            "is_processed": email_data.get("is_processed", False),
        }
        upsert_res = db.table("emails").upsert(record, on_conflict="id").execute()
        if upsert_res.data:
            return upsert_res.data[0]

    raise ValueError(f"Email {email_id} not found or not updated")

# --- Documents ---
def add_document(project_id: str, filename: str, content: str, doc_type: str = "transcript"):
    db = get_db()
    res = db.table("documents").insert({
        "project_id": project_id,
        "filename": filename,
        "content": content,
        "type": doc_type
    }).execute()
    return res.data[0] if res.data else {}

def get_project_documents(project_id: str) -> List[Dict]:
    db = get_db()
    res = db.table("documents").select("*").eq("project_id", project_id).execute()
    return res.data or []

# --- BRDs ---
def save_brd(project_id: str, content: Dict, docx_url: str = ""):
    db = get_db()
    db.table("brds").upsert({
        "project_id": project_id,
        "content": content,
        "docx_url": docx_url
    }, on_conflict="project_id").execute()

def get_brd_for_project(project_id: str) -> Optional[Dict]:
    db = get_db()
    res = db.table("brds").select("*").eq("project_id", project_id).execute()
    return res.data[0] if res.data else None

# --- Context Aggregator for Agent ---
def get_project_context_details(project_id: str) -> Dict:
    """Returns structured emails and documents for UI display."""
    db = get_db()
    emails = db.table("emails").select("*").eq("project_id", project_id).order("received_at", desc=True).execute().data or []
    docs = db.table("documents").select("*").eq("project_id", project_id).order("created_at", desc=True).execute().data or []
    return {"emails": emails, "documents": docs}

def get_project_context_string(project_id: str) -> str:
    """Aggregates context for AI Agents."""
    ctx = get_project_context_details(project_id)
    emails = ctx["emails"]
    docs = ctx["documents"]

    def _scrub_noise(text: str) -> str:
        import re
        if not text:
            return ""
        text = re.sub(r"(?i)(Message-ID|Date|From|To|Subject|Mime-Version|Content-Type|X-[a-zA-Z-]+):.*?\n", "", text)
        text = re.sub(r"\b(um|uh|like|you know|I mean|yeah|okay|right)\b", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _is_training_sample(filename: str) -> bool:
        name = (filename or "").lower()
        return any(hint in name for hint in TRAINING_HINTS)

    parts = []
    if emails:
        parts.append("--- PROJECT EMAILS ---")
        for em in emails:
            sender = em.get("sender", "")
            subj = em.get("subject", "")
            body = _scrub_noise(em.get("body", ""))[:2000]
            parts.append(f"From: {sender}\nSubject: {subj}\nBody: {body}\n")

    if docs:
        parts.append("--- PROJECT DOCUMENTS ---")
        for d in docs:
            fname = d.get("filename", "document")
            if not ALLOW_DEMO_CONTEXT and _is_training_sample(fname):
                continue
            dtype = (d.get("type") or "document").upper()
            content = _scrub_noise(d.get("content", ""))[:5000]
            parts.append(f"[{dtype}] {fname}\nContent: {content}\n")

    combined = "\n".join(parts)
    # Protect downstream LLMs from over-long contexts; ~8k tokens ≈ 32k chars
    return combined[:32000]
