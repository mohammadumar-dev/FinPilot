import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Campaign(Base):
    """A merchant-growth proposal: discount/bundle ideas over a merchant's own
    catalog, generated from that merchant's own paid-order history. Never
    applies itself — status only moves forward on an explicit merchant_admin
    action (propose -> approve -> apply), same "bounded and gated" standard
    the buyer-side checkout holds itself to."""

    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint(
            "status IN ('proposed','approved','applied','rejected','ended')", name="ck_campaigns_status"
        ),
        CheckConstraint("kind IN ('discount','bundle')", name="ck_campaigns_kind"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="proposed")
    kind: Mapped[str] = mapped_column(String, nullable=False)
    # {"summary": str, "items": [{"product_id": str, "discount_pct": int,
    #  "reasoning": str, "bundle_with_product_id": str | None}, ...]}
    proposal: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Optional window, set at apply time. No background job flips status at
    # these boundaries — campaign_service.get_effective_prices checks them
    # live on every price lookup, the same way it already checks status;
    # status stays 'applied' straight through (the UI marks it "Expired"
    # once end_date has passed) until the merchant explicitly ends it.
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
