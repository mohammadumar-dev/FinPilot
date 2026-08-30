import uuid

from pydantic import BaseModel

from app.schemas.order import OrderResponse


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
