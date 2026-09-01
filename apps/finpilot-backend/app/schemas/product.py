import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProductResponse(BaseModel):
    id: uuid.UUID
    merchant_id: uuid.UUID
    sku: str
    name: str
    description: str | None = None
    price_paise: int
    # Merchant-admin-only — never populated for a buyer/other-merchant caller
    # (see catalog.py's list_merchant_products) and never present at all on
    # ProductDetailResponse below, which the buyer-agent and MCP tools read.
    cost_price_paise: int | None = None
    rating: float
    category: str | None = None
    attributes: dict | None = None
    is_active: bool
    stock_quantity: int = 0
    variant_group: str | None = None
    variant_label: str | None = None
    # Read off Product.has_image (a plain python property — see the model),
    # never the raw image bytes themselves: those are served separately via
    # GET /products/{id}/image so this response stays light regardless of
    # image size.
    has_image: bool
    created_at: datetime
    # Set only when list_merchant_products folds in an applied-campaign
    # discount (see catalog.py) — price_paise above is already the
    # *effective* price in that case, these three are display-only extras.
    is_on_offer: bool = False
    discount_pct: int | None = None
    original_price_rupees: float | None = None

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
    stock_quantity: int = 0
    merchant_id: uuid.UUID
    merchant_name: str
    merchant_slug: str
    variant_group: str | None = None
    variant_label: str | None = None
    has_image: bool
    is_on_offer: bool = False
    discount_pct: int | None = None
    original_price_rupees: float | None = None


# SKU_SUFFIX_PATTERN mirrors the taxonomy-token style already used in every
# seeded SKU (e.g. "SHOE-MEN-RUN-PRO") — uppercase letters/digits/hyphens
# only. The merchant's fixed prefix (Merchant.sku_prefix) is prepended
# server-side; never accepted from the caller.
_SKU_SUFFIX_PATTERN = r"^[A-Z0-9][A-Z0-9-]*$"


class ProductCreateRequest(BaseModel):
    sku_suffix: str = Field(min_length=1, max_length=64, pattern=_SKU_SUFFIX_PATTERN)
    name: str
    description: str | None = None
    price_paise: int = Field(gt=0)
    # Optional — a merchant may not want to record it — but when present it
    # lets the campaign agent keep any future discount from selling below
    # cost (see campaign_service._discount_pct_for_price). Never exposed to
    # buyers or agents; merchant-admin-only, same as on ProductResponse.
    cost_price_paise: int | None = Field(default=None, ge=0)
    rating: float = 0
    category: str | None = None
    attributes: dict | None = None
    stock_quantity: int = Field(default=0, ge=0)


class ProductUpdateRequest(BaseModel):
    """Every field optional — PATCH semantics, only supplied fields change."""

    sku_suffix: str | None = Field(default=None, min_length=1, max_length=64, pattern=_SKU_SUFFIX_PATTERN)
    name: str | None = None
    description: str | None = None
    price_paise: int | None = Field(default=None, gt=0)
    cost_price_paise: int | None = Field(default=None, ge=0)
    rating: float | None = None
    category: str | None = None
    attributes: dict | None = None
    stock_quantity: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
