import uuid
from datetime import datetime

from pydantic import BaseModel


class CampaignItem(BaseModel):
    product_id: str
    product_name: str
    discount_pct: int
    reasoning: str
    bundle_with_product_id: str | None = None
    bundle_with_product_name: str | None = None


class CampaignProposal(BaseModel):
    summary: str
    items: list[CampaignItem]


class CampaignResponse(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    status: str
    kind: str
    proposal: CampaignProposal
    created_by_user_id: uuid.UUID
    approved_by_user_id: uuid.UUID | None
    approved_at: datetime | None
    applied_at: datetime | None
    start_date: datetime | None = None
    end_date: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplyCampaignRequest(BaseModel):
    """Both optional — omit either (or the whole body) for an indefinite
    campaign, same as before scheduling existed."""

    start_date: datetime | None = None
    end_date: datetime | None = None
