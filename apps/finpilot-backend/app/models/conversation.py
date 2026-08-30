import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # Nullable: chats are global-scoped across every merchant's catalog (a single
    # thread can shop shoes from one store and gadgets from another), so a
    # conversation is no longer pinned to one merchant. Kept only for backward
    # compatibility with rows created before this change.
    merchant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (CheckConstraint("role IN ('user','agent','tool')", name="ck_messages_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str | None] = mapped_column(String, nullable=True)
    tool_call: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Postgres's now()/CURRENT_TIMESTAMP is fixed at transaction start, so
    # several messages inserted within the same transaction (as the agent
    # loop does — one turn can add many rows before a single commit) get an
    # IDENTICAL created_at, making `ORDER BY created_at` non-deterministic and
    # able to replay history out of order (a tool result before the user
    # message that triggered it). This auto-incrementing column is the only
    # reliable ordering key — always order messages by this, not created_at.
    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=False), unique=True, nullable=False)
