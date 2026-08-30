import uuid
from datetime import datetime

from pydantic import BaseModel


class OrderResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    merchant_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    amount_paise: int
    razorpay_order_id: str | None = None
    payment_link: str | None = None
    status: str
    placed_by: str
    agent_client_id: uuid.UUID | None = None
    failure_reason: str | None = None
    idempotency_key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogEntryResponse(BaseModel):
    id: uuid.UUID
    action: str
    reasoning: str | None = None
    payload: dict | None = None
    amount_paise: int | None = None
    outcome: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
