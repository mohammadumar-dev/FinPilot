import uuid
from datetime import datetime

from pydantic import BaseModel


class MerchantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    razorpay_account_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
