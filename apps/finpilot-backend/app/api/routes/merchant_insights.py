import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.insights import MerchantInsightsResponse
from app.services.insights_service import get_merchant_insights

router = APIRouter(prefix="/merchant/{merchant_id}/insights", tags=["merchant-insights"])


def _require_own_merchant(merchant_id: uuid.UUID, admin: User) -> None:
    if admin.merchant_id != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin for this merchant")


@router.get("", response_model=MerchantInsightsResponse)
def get_insights(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> dict:
    _require_own_merchant(merchant_id, admin)
    return get_merchant_insights(db, merchant_id)
