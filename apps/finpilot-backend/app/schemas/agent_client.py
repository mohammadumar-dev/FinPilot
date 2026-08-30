import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AgentClientResponse(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    name: str
    max_order_amount_paise: int
    max_orders_per_day: int
    revoked: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentClientCreateRequest(BaseModel):
    name: str
    max_order_amount_paise: int = Field(gt=0)
    max_orders_per_day: int = Field(gt=0)


class AgentClientCreateResponse(AgentClientResponse):
    api_key: str  # plaintext — shown exactly once, at issuance
