import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("status IN ('created','pending','paid','failed')", name="ck_orders_status"),
        CheckConstraint("placed_by IN ('buyer_chat','external_agent')", name="ck_orders_placed_by"),
        Index("ix_orders_user_id", "user_id"),
        Index("ix_orders_idempotency_key", "idempotency_key", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Nullable: orders placed by an external agent (placed_by='external_agent')
    # have no buyer session — the MCP tools authenticate via a merchant-scoped
    # API key, not a user identity.
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    # Holds a Razorpay Payment Link id (e.g. "plink_...") — checkout is done via
    # the Payment Links API, not a bare Order, since a plain Order has no
    # hosted checkout page on its own (that requires embedding Checkout.js).
    razorpay_order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    # The real hosted checkout URL (Razorpay's `short_url`). Not derivable from
    # razorpay_order_id — it's a random slug assigned at creation — so it must
    # be persisted, not reconstructed.
    payment_link: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="created")
    placed_by: Mapped[str] = mapped_column(String, nullable=False, default="buyer_chat")
    agent_client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_clients.id"), nullable=True
    )
    failure_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
