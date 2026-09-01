import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.order import AuditLogEntryResponse
from app.services.audit_service import list_growth_audit_for_merchant

router = APIRouter(prefix="/merchant/{merchant_id}/audit-trail", tags=["merchant-audit"])


def _require_own_merchant(merchant_id: uuid.UUID, admin: User) -> None:
    if admin.merchant_id != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin for this merchant")


@router.get("", response_model=list[AuditLogEntryResponse])
def get_merchant_audit_trail(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> list[AuditLog]:
    """Every campaign_*/ad_* action logged for this merchant — deliberately
    not buyer-chat tool calls (search_catalog, create_order, ...), which
    already have their own per-order (merchant_orders.py) and
    per-conversation (audit.py) trail views."""
    _require_own_merchant(merchant_id, admin)
    return list_growth_audit_for_merchant(db, merchant_id)
