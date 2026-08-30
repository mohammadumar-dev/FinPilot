import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, LargeBinary, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (Index("ix_products_merchant_category", "merchant_id", "category"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False)
    sku: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[float] = mapped_column(Numeric(2, 1), default=0)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    # Product photo, stored as compressed WebP bytes (not base64 — that would
    # inflate storage ~33% for a value that's only ever served raw, never
    # queried). Served separately via GET /products/{id}/image rather than
    # embedded in ProductResponse/search_catalog JSON, so list/search
    # payloads stay light; those responses instead carry a `has_image` bool.
    image_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    image_mime_type: Mapped[str | None] = mapped_column(String, nullable=True)
    # Groups size/weight variants of the same base item (e.g. every Basmati
    # Rice weight shares one variant_group) so the agent and UI can present
    # them together instead of as unrelated products; variant_label is the
    # human-facing size, e.g. "1kg".
    variant_group: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    variant_label: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    merchant: Mapped["Merchant"] = relationship(back_populates="products")  # noqa: F821

    @property
    def has_image(self) -> bool:
        """Cheap bool for ProductResponse — never serialize image_data itself
        (that's served separately via GET /products/{id}/image)."""
        return self.image_data is not None
