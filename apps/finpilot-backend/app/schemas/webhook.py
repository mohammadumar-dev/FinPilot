from pydantic import BaseModel


class WebhookAck(BaseModel):
    received: bool
    order_status: str | None = None
