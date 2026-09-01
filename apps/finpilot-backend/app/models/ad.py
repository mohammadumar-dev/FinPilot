import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdWallet(Base):
    """One per merchant. balance_paise is the fast-path source of truth for
    "can this campaign afford another click" checks (ads_service.charge_click)
    — the append-only trail of how it got there lives in audit_log
    (ad_wallet_topped_up / ad_click_charged rows), same two-tier pattern as
    Order.status + audit_log elsewhere in this codebase."""

    __tablename__ = "ad_wallets"
    __table_args__ = (CheckConstraint("balance_paise >= 0", name="ck_ad_wallets_balance_non_negative"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False, unique=True
    )
    balance_paise: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdWalletTopup(Base):
    """A real Razorpay test-mode payment topping up a merchant's ad wallet —
    same shape as Order (razorpay_order_id/payment_link/status), so the
    existing webhook/polling confirmation machinery has something Order-shaped
    to update. The wallet balance is credited only when this reaches 'paid'
    (ads_service.confirm_topup), never on creation."""

    __tablename__ = "ad_wallet_topups"
    __table_args__ = (
        CheckConstraint("status IN ('created','pending','paid','failed')", name="ck_ad_wallet_topups_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False)
    razorpay_order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_link: Mapped[str | None] = mapped_column(String, nullable=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="created")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdCampaign(Base):
    """A merchant paying to boost one product into matching search results
    (see catalog_service.search_catalog's sponsored-slot injection). Bounded
    by cost_per_click_paise (re-derived server-side on every charge, never
    trusted from a caller) and daily_budget_paise (checked against the day's
    ad_click_charged audit rows) — the same bounded/gated standard the rest
    of this app holds every money action to."""

    __tablename__ = "ad_campaigns"
    __table_args__ = (
        CheckConstraint("status IN ('active','paused','ended')", name="ck_ad_campaigns_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    cost_per_click_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    daily_budget_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
