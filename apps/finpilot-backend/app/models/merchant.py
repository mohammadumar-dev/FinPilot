import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Stable, URL-safe identifier for the client-side merchant pages
    # (/dashboard/merchants/{slug}) — resolved entirely in the frontend
    # against the existing /merchants list, so this is the only new field
    # those pages need from the backend.
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    # Fixed prefix every one of this merchant's SKUs starts with (e.g. "SF"
    # for StepForward -> "SF-SHOE-MEN-RUN-PRO"). Seed/admin-managed only —
    # never typed by a merchant at runtime; product creation derives the full
    # SKU from this plus a merchant-supplied suffix (see merchant_products.py).
    sku_prefix: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    razorpay_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    admins: Mapped[list["User"]] = relationship(back_populates="merchant")  # noqa: F821
    products: Mapped[list["Product"]] = relationship(back_populates="merchant")  # noqa: F821
