# Security & guardrails

No layer trusts a caller for anything money-shaped — price, stock, and budget are always
re-derived server-side, on every path, every time.

## JWT auth (`app/core/security.py`, `app/core/config.py`)

- `jose.jwt` with `settings.JWT_SECRET_KEY` / `JWT_ALGORITHM` (default `HS256`).
- **Access tokens** — `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30), claim `type: "access"`.
- **Refresh tokens** — `REFRESH_TOKEN_EXPIRE_DAYS` (default 7), claim `type: "refresh"`.
- Every issued token is also persisted, hashed via SHA-256 (`hash_token`), in the
  `access_tokens`/`refresh_tokens` tables — refresh tokens can be individually revoked.
- `decode_token` returns `None` on any `JWTError` (expired, invalid, tampered).
- Passwords: `passlib.CryptContext(schemes=["bcrypt"])`.

## FastAPI auth dependencies (`app/api/deps.py`)

- `get_current_user` — `HTTPBearer(auto_error=False)`, decodes the token, requires
  `type == "access"`, loads the `User` by `sub` (UUID). `401` on any failure.
- `get_current_merchant_admin` — wraps `get_current_user`, additionally requires
  `role == "merchant_admin"` and a non-null `merchant_id`. `403` otherwise.

## Roles

- `User.role` is `CHECK`-constrained to `buyer` | `merchant_admin` (set at `/auth/register`,
  defaults to `buyer` if invalid/omitted).
- Buyer-facing endpoints (`chat`, `cart`, `orders`, catalog browsing, `conversations`, `audit`)
  require only `get_current_user`.
- Every `/merchant/{merchant_id}/...` endpoint requires `get_current_merchant_admin` **and** an
  explicit `_require_own_merchant(merchant_id, admin)` check — `403` if `admin.merchant_id`
  doesn't match the path param. A merchant admin can only ever manage their own merchant.

## Scoped agent-client API keys (external MCP agents)

Not JWT — a distinct credential type, the "mandate-lite" approach: a merchant-issued API key
carrying a pre-authorized spend envelope (`max_order_amount_paise`, `max_orders_per_day`) rather
than a full signed-mandate protocol.

- Generated as `fp_live_<32-byte urlsafe token>`, shown once at creation, stored only as a
  bcrypt hash (same `pwd_context` used for user passwords).
- Verified per-request by `resolve_agent_client` (`mcp_server/auth.py`) — a linear bcrypt-verify
  scan over non-revoked clients (acceptable at hackathon scale) — and exposed to MCP tool
  functions via a `ContextVar`, since MCP tools run outside FastAPI's request-scoped DI.
- Revocation (`POST /merchant/{merchant_id}/agent-clients/{id}/revoke`) sets `revoked: true`,
  excluded immediately from the resolver's candidate query — **fails closed on the very next
  call**, not just at "connection" time (the transport is stateless, so there's no persistent
  connection to invalidate anyway).

## The guardrails, end to end

| Guardrail | Where |
|---|---|
| **Spend envelope** | Per-agent-client order cap and daily order-count cap, enforced before Razorpay is ever called ([`mcp-protocol.md`](./mcp-protocol.md)). |
| **Confirmation gate** | A human buyer's order is blocked unless the buyer affirmatively answered a purchase question about that exact, previously-shown product ([`buyer-agent-workflow.md`](./buyer-agent-workflow.md)). |
| **Server-derived pricing** | Price and stock are always re-read from the database at order time — never trusted from an agent-claimed value. |
| **Idempotent by construction** | A unique DB index, not an in-memory check, so a retried or duplicated call can never double-charge ([`order-payment-lifecycle.md`](./order-payment-lifecycle.md)). |
| **Full audit trail** | Every search, order, payment, campaign, and ad action is appended to one `audit_log` — success, failed, and blocked outcomes alike. |
| **Fail-closed revocation** | A revoked agent-client key is rejected on its very next MCP call, checked fresh, never cached. |
| **Cost floor on discounts** | The campaign orchestrator caps a discount so price never drops below cost + a margin floor, when cost is on file ([`merchant-agents.md`](./merchant-agents.md)). |
| **Webhook signature verification** | HMAC-verified via `RAZORPAY_WEBHOOK_SECRET`; unverified acceptance is explicit, logged, local-dev-only behavior. |
| **Never a hard delete on money-linked rows** | Product deletion is a soft delete (`is_active: false`) — `Order`/`CartItem` foreign keys are never orphaned. |
