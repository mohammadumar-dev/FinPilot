import uuid
from datetime import datetime

from pydantic import BaseModel


class ProductResponse(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    sku: str
    name: str
    description: str | None = None
    price_paise: int
    rating: float
    category: str | None = None
    attributes: dict | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductCreateRequest(BaseModel):
    sku: str
    name: str
    description: str | None = None
    price_paise: int
    rating: float = 0
    category: str | None = None
    attributes: dict | None = None
