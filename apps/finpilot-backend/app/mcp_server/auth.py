"""Scoped API-key auth for the Agent Checkout MCP server — the "mandate-lite"
approach from the plan (section 4.2): a merchant-issued API key carrying a
pre-authorized spend envelope, not a full signed-mandate protocol.

Resolved once per inbound HTTP request by ApiKeyAuthMiddleware and exposed to
tool functions via a contextvar (tools run outside FastAPI's DI system, so
they can't take a Depends()-injected identity the way REST routes do)."""

import uuid
from contextvars import ContextVar
from dataclasses import dataclass

from app.core.security import verify_api_key
from app.db.session import SessionLocal
from app.models.agent_client import AgentClient


@dataclass(frozen=True)
class AgentIdentity:
    id: uuid.UUID
    merchant_id: uuid.UUID
    name: str
    max_order_amount_paise: int
    max_orders_per_day: int


current_agent: ContextVar[AgentIdentity | None] = ContextVar("current_agent", default=None)


def resolve_agent_client(api_key: str) -> AgentIdentity | None:
    """Bcrypt-hashed keys can't be looked up by equality, so this checks the
    (small) set of non-revoked clients one by one. A revoked
    client is excluded here, so revocation fails closed immediately on the
    very next call — not just at initial connection time."""
    db = SessionLocal()
    try:
        candidates = db.query(AgentClient).filter(AgentClient.revoked.is_(False)).all()
        for candidate in candidates:
            if verify_api_key(api_key, candidate.api_key_hash):
                return AgentIdentity(
                    id=candidate.id,
                    merchant_id=candidate.merchant_id,
                    name=candidate.name,
                    max_order_amount_paise=candidate.max_order_amount_paise,
                    max_orders_per_day=candidate.max_orders_per_day,
                )
        return None
    finally:
        db.close()
