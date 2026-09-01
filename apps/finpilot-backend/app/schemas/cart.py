import uuid

from pydantic import BaseModel

from app.schemas.order import OrderResponse


class RelatedProductResponse(BaseModel):
    product_id: str
    sku: str
    name: str
    price_paise: int
    price_rupees: float
    rating: float
    category: str | None = None
    merchant_id: str
    merchant_name: str
    variant_group: str | None = None
    variant_label: str | None = None
    has_image: bool
    stock_quantity: int = 0
    score: float


class CartItemResponse(BaseModel):
    product_id: uuid.UUID
    sku: str
    name: str
    price_paise: int
    price_rupees: float
    quantity: int
    line_total_paise: int
    merchant_id: uuid.UUID
    merchant_name: str
    category: str | None = None
    variant_label: str | None = None
    has_image: bool
    unavailable: bool = False
    stock_quantity: int = 0
    related_products: list[RelatedProductResponse] = []


class CartUpsertRequest(BaseModel):
    product_id: uuid.UUID
    quantity: int


class CartCheckoutError(BaseModel):
    product_id: uuid.UUID
    code: str
    message: str


class CartCheckoutResponse(BaseModel):
    orders: list[OrderResponse]
    errors: list[CartCheckoutError]
