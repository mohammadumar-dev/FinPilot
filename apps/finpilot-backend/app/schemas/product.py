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
    variant_group: str | None = None
    variant_label: str | None = None
    # Read off Product.has_image (a plain python property — see the model),
    # never the raw image bytes themselves: those are served separately via
    # GET /products/{id}/image so this response stays light regardless of
    # image size.
    has_image: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductDetailResponse(BaseModel):
    """Shape of catalog_service.get_product_detail's dict — used by the
    product detail page (GET /products/{id}) and, unchanged, by the chat
    agent's get_product_detail tool."""

    product_id: uuid.UUID
    sku: str
    name: str
    description: str | None = None
    price_paise: int
    price_rupees: float
    rating: float
    category: str | None = None
    attributes: dict | None = None
    merchant_id: uuid.UUID
    merchant_name: str
    merchant_slug: str
    variant_group: str | None = None
    variant_label: str | None = None
    has_image: bool


class ProductCreateRequest(BaseModel):
    sku: str
    name: str
    description: str | None = None
    price_paise: int
    rating: float = 0
    category: str | None = None
    attributes: dict | None = None
