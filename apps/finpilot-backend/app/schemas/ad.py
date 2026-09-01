import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AdWalletTopupResponse(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    amount_paise: int
    status: str
    payment_link: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdWalletResponse(BaseModel):
    merchant_id: uuid.UUID
    balance_paise: int
    recent_topups: list[AdWalletTopupResponse] = []


class AdWalletTopupRequest(BaseModel):
    amount_paise: int = Field(gt=0)


class AdCampaignResponse(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    product_id: uuid.UUID
    status: str
    cost_per_click_paise: int
    daily_budget_paise: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AdCampaignCreateRequest(BaseModel):
    product_id: uuid.UUID
    cost_per_click_paise: int = Field(gt=0)
    daily_budget_paise: int = Field(gt=0)


class AdClickResponse(BaseModel):
    ok: bool
    reason: str | None = None
    charged_paise: int | None = None
    remaining_balance_paise: int | None = None
