import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin
from app.db.session import get_db
from app.models.campaign import Campaign
from app.models.user import User
from app.schemas.campaign import ApplyCampaignRequest, CampaignResponse
from app.services import campaign_service
from app.services.campaign_service import CampaignError

router = APIRouter(prefix="/merchant/{merchant_id}/campaigns", tags=["campaigns"])


def _require_own_merchant(merchant_id: uuid.UUID, admin: User) -> None:
    if admin.merchant_id != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin for this merchant")


def _to_http_error(e: CampaignError) -> HTTPException:
    status_code = status.HTTP_409_CONFLICT if e.code == "invalid_status" else status.HTTP_400_BAD_REQUEST
    if e.code == "campaign_not_found":
        status_code = status.HTTP_404_NOT_FOUND
    return HTTPException(status_code=status_code, detail={"code": e.code, "message": e.message})


@router.get("", response_model=list[CampaignResponse])
def list_campaigns(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> list[Campaign]:
    _require_own_merchant(merchant_id, admin)
    return campaign_service.list_campaigns(db, merchant_id)


@router.post("/propose", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def propose_campaign(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Campaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return campaign_service.propose_campaign(db, merchant_id, admin.id)
    except CampaignError as e:
        raise _to_http_error(e)


@router.post("/{campaign_id}/approve", response_model=CampaignResponse)
def approve_campaign(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Campaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return campaign_service.approve_campaign(db, merchant_id, campaign_id, admin.id)
    except CampaignError as e:
        raise _to_http_error(e)


@router.post("/{campaign_id}/apply", response_model=CampaignResponse)
def apply_campaign(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: ApplyCampaignRequest = ApplyCampaignRequest(),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Campaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return campaign_service.apply_campaign(
            db, merchant_id, campaign_id, admin.id, start_date=payload.start_date, end_date=payload.end_date
        )
    except CampaignError as e:
        raise _to_http_error(e)


@router.patch("/{campaign_id}/schedule", response_model=CampaignResponse)
def update_campaign_schedule(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: ApplyCampaignRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Campaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return campaign_service.update_schedule(
            db, merchant_id, campaign_id, admin.id, start_date=payload.start_date, end_date=payload.end_date
        )
    except CampaignError as e:
        raise _to_http_error(e)


@router.post("/{campaign_id}/end", response_model=CampaignResponse)
def end_campaign(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Campaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return campaign_service.end_campaign(db, merchant_id, campaign_id, admin.id)
    except CampaignError as e:
        raise _to_http_error(e)


@router.post("/{campaign_id}/reject", response_model=CampaignResponse)
def reject_campaign(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> Campaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return campaign_service.reject_campaign(db, merchant_id, campaign_id, admin.id)
    except CampaignError as e:
        raise _to_http_error(e)
