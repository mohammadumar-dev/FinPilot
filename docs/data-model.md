# Data model

SQLAlchemy models, migrated with Alembic (`apps/finpilot-backend/alembic/`). Money is always
integer **paise** (never a float rupee amount), and every state machine — orders, campaigns, ad
campaigns — is a `CHECK`-constrained status column, never a free string.

## Tables

### `users` (`User`)
A buyer or a `merchant_admin` — `role` is `CHECK`-constrained to those two values.
`merchant_id` is set only for admins.

| Field | Notes |
|---|---|
| `email` | unique |
| `password_hash` | bcrypt |
| `role` | `buyer` \| `merchant_admin` |
| `merchant_id` | FK → merchants, nullable |

Also in `app/models/user.py`: `AccessToken`, `RefreshToken` — `user_id` FK, `token_hash` (SHA-256
of the JWT string), `expires_at`, `revoked` (refresh only).

### `merchants` (`Merchant`)
One seller. `sku_prefix` namespaces every product SKU it creates.

| Field | Notes |
|---|---|
| `slug` | unique, URL-safe |
| `sku_prefix` | fixed prefix for this merchant's SKUs |
| `razorpay_account_id` | nullable |

Relationships: `admins` (Users), `products` (Products).

### `products` (`Product`)
| Field | Notes |
|---|---|
| `merchant_id` | FK |
| `sku` | `{merchant.sku_prefix}-{suffix}` |
| `price_paise` | raw catalog price |
| `cost_price_paise` | nullable, **never exposed to buyers/agents** — floors campaign discounts server-side only |
| `rating` | `Numeric(2,1)` |
| `stock_quantity` | re-checked server-side on every order |
| `variant_group` / `variant_label` | groups size/weight variants of the same item |
| `image_data` / `image_mime_type` | WebP bytes, served via a dedicated route |

Indexed on `(merchant_id, category)`.

### `orders` (`Order`)
The single table both front doors write to.

| Field | Notes |
|---|---|
| `user_id` | FK, nullable — null for external-agent orders |
| `agent_client_id` | FK, nullable — set for external-agent orders |
| `placed_by` | `buyer_chat` \| `external_agent` |
| `status` | `created` → `pending` → `paid` \| `failed` |
| `amount_paise` | unit price × quantity, computed server-side |
| `razorpay_order_id` | actually holds the Razorpay **Payment Link** id |
| `payment_link` | hosted checkout `short_url` |
| `idempotency_key` | unique index — see [`order-payment-lifecycle.md`](./order-payment-lifecycle.md) |

### `cart_items` (`CartItem`)
One row per `(user_id, product_id)` (unique constraint), so quantity upserts are idempotent.

### `conversations` / `messages` (`Conversation`, `Message`)
| Field | Notes |
|---|---|
| `Message.role` | `user` \| `agent` \| `tool` |
| `Message.tool_call` | JSONB — the tool request/result payload |
| `Message.seq` | an `Identity` column, **unique** — the authoritative ordering key, since `created_at` can collide within one DB transaction |

`Conversation.merchant_id` is nullable and legacy-only; chat is a global marketplace, not
merchant-scoped.

### `agent_clients` (`AgentClient`)
A merchant-issued, scoped API key for one external AI agent — its spend envelope lives here.

| Field | Notes |
|---|---|
| `api_key_hash` | bcrypt hash of `fp_live_...` |
| `max_order_amount_paise` | per-order cap |
| `max_orders_per_day` | rolling 24h order-count cap |
| `revoked` | checked fresh on every MCP request |

### `audit_log` (`AuditLog`)
One append-only trail every service writes to.

| Field | Notes |
|---|---|
| `action` | e.g. `search_catalog`, `create_order`, `campaign_proposed`, `ad_click_charged`, `payment_confirmed` |
| `outcome` | `success` \| `failed` \| `blocked` |
| `amount_paise` | nullable — set for money-relevant actions |
| `payload` | JSONB |

Indexed on `conversation_id` and `agent_client_id`.

### `campaigns` (`Campaign`)
A discount/bundle proposal from the campaign orchestrator.

| Field | Notes |
|---|---|
| `status` | `proposed` → `approved` → `applied` → `ended` (or `rejected` from `proposed`/`approved`) |
| `kind` | `discount` \| `bundle` |
| `proposal` | JSONB: `{"summary": str, "items": [{product_id, discount_pct, reasoning, bundle_with_product_id?, bundle_with_product_name?}]}` |
| `start_date` / `end_date` | optional — checked live at price-lookup time, no background job |

Never mutates `Product.price_paise` directly — see
[`merchant-agents.md`](./merchant-agents.md#how-an-applied-discount-surfaces-to-buyers).

### `ad_wallets` / `ad_wallet_topups` / `ad_campaigns` (`app/models/ad.py`)
| Table | Notes |
|---|---|
| `AdWallet` | one per merchant (unique), `balance_paise` (`CHECK >= 0`) |
| `AdWalletTopup` | shaped like `Order` (`razorpay_order_id`, `payment_link`, `status`) so the same webhook/polling machinery updates it |
| `AdCampaign` | `product_id`, `cost_per_click_paise`, `daily_budget_paise`, `status: active \| paused \| ended` |

## Relationship summary

- **Merchant** 1—N User (admins), 1—N Product, 1—N Order, 1—1 AdWallet, 1—N AdWalletTopup,
  1—N AdCampaign, 1—N Campaign, 1—N AgentClient.
- **User** 1—N Conversation, 1—N Order (buyer_chat orders), 1—N AccessToken/RefreshToken.
- **Product** 1—N Order, 1—N CartItem, 1—N AdCampaign.
- **Conversation** 1—N Message, 1—N AuditLog (via `conversation_id`).
- **AgentClient** 1—N Order (external_agent orders), 1—N AuditLog (via `agent_client_id`).
- **Order** N—1 Product, N—1 Merchant, N—1 User (nullable) / AgentClient (nullable).
