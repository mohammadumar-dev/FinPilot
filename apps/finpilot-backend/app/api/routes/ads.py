import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_merchant_admin, get_current_user
from app.db.session import get_db
from app.models.ad import AdCampaign
from app.models.user import User
from app.schemas.ad import (
    AdCampaignCreateRequest,
    AdCampaignResponse,
    AdClickResponse,
    AdWalletResponse,
    AdWalletTopupRequest,
    AdWalletTopupResponse,
)
from app.services import ads_service
from app.services.ads_service import AdsError

merchant_router = APIRouter(prefix="/merchant/{merchant_id}/ads", tags=["ads"])
click_router = APIRouter(prefix="/ads", tags=["ads"])


def _require_own_merchant(merchant_id: uuid.UUID, admin: User) -> None:
    if admin.merchant_id != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin for this merchant")


def _to_http_error(e: AdsError) -> HTTPException:
    status_code = status.HTTP_409_CONFLICT if e.code == "invalid_status" else status.HTTP_400_BAD_REQUEST
    if e.code in ("campaign_not_found", "product_not_found"):
        status_code = status.HTTP_404_NOT_FOUND
    return HTTPException(status_code=status_code, detail={"code": e.code, "message": e.message})


@merchant_router.get("/wallet", response_model=AdWalletResponse)
def get_wallet(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> dict:
    _require_own_merchant(merchant_id, admin)
    wallet = ads_service.get_or_create_wallet(db, merchant_id)
    topups = ads_service.list_topups(db, merchant_id)
    return {"merchant_id": merchant_id, "balance_paise": wallet.balance_paise, "recent_topups": topups[:10]}


@merchant_router.post("/wallet/topup", response_model=AdWalletTopupResponse, status_code=status.HTTP_201_CREATED)
def topup_wallet(
    merchant_id: uuid.UUID,
    payload: AdWalletTopupRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> AdWalletTopupResponse:
    _require_own_merchant(merchant_id, admin)
    try:
        return ads_service.top_up_wallet(db, merchant_id, payload.amount_paise)
    except AdsError as e:
        raise _to_http_error(e)


@merchant_router.get("/campaigns", response_model=list[AdCampaignResponse])
def list_campaigns(
    merchant_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> list[AdCampaign]:
    _require_own_merchant(merchant_id, admin)
    return ads_service.list_campaigns(db, merchant_id)


@merchant_router.post("/campaigns", response_model=AdCampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(
    merchant_id: uuid.UUID,
    payload: AdCampaignCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> AdCampaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return ads_service.create_campaign(
            db, merchant_id, payload.product_id, payload.cost_per_click_paise, payload.daily_budget_paise, admin.id
        )
    except AdsError as e:
        raise _to_http_error(e)


@merchant_router.post("/campaigns/{campaign_id}/pause", response_model=AdCampaignResponse)
def pause_campaign(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> AdCampaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return ads_service.pause_campaign(db, merchant_id, campaign_id, admin.id)
    except AdsError as e:
        raise _to_http_error(e)


@merchant_router.post("/campaigns/{campaign_id}/resume", response_model=AdCampaignResponse)
def resume_campaign(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> AdCampaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return ads_service.resume_campaign(db, merchant_id, campaign_id, admin.id)
    except AdsError as e:
        raise _to_http_error(e)


@merchant_router.post("/campaigns/{campaign_id}/end", response_model=AdCampaignResponse)
def end_campaign(
    merchant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_merchant_admin),
) -> AdCampaign:
    _require_own_merchant(merchant_id, admin)
    try:
        return ads_service.end_campaign(db, merchant_id, campaign_id, admin.id)
    except AdsError as e:
        raise _to_http_error(e)


@click_router.post("/{ad_campaign_id}/click", response_model=AdClickResponse)
def track_click(
    ad_campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    """Any logged-in buyer can fire this — it's what a sponsored product card
    calls when clicked. Never raises on insufficient funds/budget: a
    graceful no-op (ok: False) is the whole point, the campaign just stops
    serving until topped up or the next day, exactly like search_catalog
    already stops offering it once the wallet can't afford another click."""
    return ads_service.charge_click(db, ad_campaign_id)
