import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

# Every action campaign_service/ads_service logs is one of these prefixes —
# used to scope the merchant-wide audit view to "my growth-agent activity"
# without pulling in buyer-chat tool calls (search_catalog, create_order,
# ...), which already have their own per-order/per-conversation trail views.
_MERCHANT_GROWTH_ACTION_PREFIXES = ("campaign_", "ad_")
# ad_impression fires on every search that surfaces a sponsored slot — real
# signal for insights_service's per-campaign impression *count*, but far too
# high-volume to read as a discrete decision in this action-by-action trail
# (which is why campaign_proposed, ad_campaign_paused, etc. exist here).
_EXCLUDED_FROM_GROWTH_AUDIT = ("ad_impression",)


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


def list_growth_audit_for_merchant(db: Session, merchant_id: uuid.UUID, limit: int = 200) -> list[AuditLog]:
    """Every campaign_*/ad_* action logged for this merchant — the merchant
    admin's own "what has my growth agent done" view, distinct from the
    per-order audit trail on the Orders page (which already covers
    buyer-chat tool calls for a single order)."""
    action_clauses = [AuditLog.action.like(f"{prefix}%") for prefix in _MERCHANT_GROWTH_ACTION_PREFIXES]
    return (
        db.query(AuditLog)
        .filter(AuditLog.payload["merchant_id"].astext == str(merchant_id))
        .filter(or_(*action_clauses))
        .filter(AuditLog.action.notin_(_EXCLUDED_FROM_GROWTH_AUDIT))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
