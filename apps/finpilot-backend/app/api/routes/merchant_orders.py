import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.order import Order
from app.models.user import User
from app.schemas.order import AuditLogEntryResponse, OrderResponse

router = APIRouter(prefix="/merchant/{merchant_id}/orders", tags=["merchant-orders"])


def _require_own_merchant(merchant_id: uuid.UUID, admin: User) -> None:
    if admin.merchant_id != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin for this merchant")


@router.get("", response_model=list[OrderResponse])
def list_orders_for_merchant(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> list[Order]:
    """Every order placed against this merchant's catalog, regardless of
    who placed it — a human buyer in chat, or an external AI agent through
    the MCP path — same "one merchant, every checkout front door" view the
    Merchant Checkout Core already gives buyers of their own orders."""
    _require_own_merchant(merchant_id, admin)
    return (
        db.query(Order)
        .filter(Order.merchant_id == merchant_id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .all()
    )


@router.get("/{order_id}/audit-trail", response_model=list[AuditLogEntryResponse])
def get_order_audit_trail_for_merchant(
    merchant_id: uuid.UUID,
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> list[AuditLog]:
    _require_own_merchant(merchant_id, admin)
    order = db.query(Order).filter(Order.id == order_id, Order.merchant_id == merchant_id).one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    return (
        db.query(AuditLog)
        .filter(AuditLog.payload["order_id"].astext == str(order_id))
        .order_by(AuditLog.created_at)
        .all()
    )
