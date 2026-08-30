import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_audit(
    db: Session,
    action: str,
    outcome: str,
    reasoning: str | None = None,
    payload: dict | None = None,
    user_id: uuid.UUID | None = None,
    conversation_id: uuid.UUID | None = None,
    agent_client_id: uuid.UUID | None = None,
    amount_paise: int | None = None,
) -> AuditLog:
    """Every tool call — chat or external-agent — must go through here before/after execution."""
    entry = AuditLog(
        user_id=user_id,
        conversation_id=conversation_id,
        agent_client_id=agent_client_id,
        action=action,
        reasoning=reasoning,
        payload=payload,
        amount_paise=amount_paise,
        outcome=outcome,
    )
    db.add(entry)
    db.flush()
    return entry
