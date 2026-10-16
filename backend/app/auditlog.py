import hashlib
import json
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AuditEvent


def _canon(event: dict) -> str:
    return json.dumps(event, sort_keys=True, separators=(",", ":"))


def append_audit(db: Session, actor_id: int | None, action: str, entity: str, entity_id: str, metadata: dict, ip: str = "") -> AuditEvent:
    previous = db.scalar(select(AuditEvent).order_by(AuditEvent.id.desc()))
    prev_hash = previous.event_hash if previous else "0" * 64
    event_uid = uuid.uuid4().hex[:16]
    body = {
        "event_uid": event_uid,
        "actor_id": actor_id,
        "action": action,
        "entity": entity,
        "entity_id": str(entity_id),
        "metadata": metadata,
        "prev_hash": prev_hash,
    }
    digest = hashlib.sha256(_canon(body).encode()).hexdigest()
    row = AuditEvent(
        event_uid=event_uid,
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id),
        metadata_json=json.dumps(metadata),
        prev_hash=prev_hash,
        event_hash=digest,
        ip_address=(ip or "")[:64],
    )
    db.add(row)
    db.flush()
    return row


def verify_chain(db: Session) -> dict:
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.id.asc())).all()
    prev = "0" * 64
    for row in rows:
        if row.prev_hash != prev:
            return {"ok": False, "broken_at": row.event_uid, "reason": "previous hash mismatch"}
        body = {
            "event_uid": row.event_uid,
            "actor_id": row.actor_id,
            "action": row.action,
            "entity": row.entity,
            "entity_id": row.entity_id,
            "metadata": json.loads(row.metadata_json or "{}"),
            "prev_hash": row.prev_hash,
        }
        digest = hashlib.sha256(_canon(body).encode()).hexdigest()
        if digest != row.event_hash:
            return {"ok": False, "broken_at": row.event_uid, "reason": "event hash mismatch"}
        prev = row.event_hash
    return {"ok": True, "events": len(rows), "head": prev}


def proof_for(db: Session, entity: str, entity_id: str) -> dict | None:
    row = db.scalar(
        select(AuditEvent)
        .where(AuditEvent.entity == entity, AuditEvent.entity_id == str(entity_id))
        .order_by(AuditEvent.id.desc())
    )
    if not row:
        return None
    previous = db.scalar(select(AuditEvent).where(AuditEvent.id < row.id).order_by(AuditEvent.id.desc()))
    prev = previous.event_hash if previous else "0" * 64
    body = {
        "event_uid": row.event_uid,
        "actor_id": row.actor_id,
        "action": row.action,
        "entity": row.entity,
        "entity_id": row.entity_id,
        "metadata": json.loads(row.metadata_json or "{}"),
        "prev_hash": row.prev_hash,
    }
    digest = hashlib.sha256(_canon(body).encode()).hexdigest()
    return {
        "event_uid": row.event_uid,
        "hash": row.event_hash,
        "prev": row.prev_hash,
        "intact": row.prev_hash == prev and digest == row.event_hash,
    }
