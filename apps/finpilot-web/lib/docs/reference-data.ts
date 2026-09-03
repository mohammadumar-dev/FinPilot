/** Reference content for the docs page. Kept as data rather than JSX so the
 * page component stays about layout, and so the same facts can be filtered,
 * counted, and searched without re-reading markup. */

export const DEMO_ACCOUNTS = [
  { role: "Buyer", email: "buyer@finpilot.com", entry: "/login → /dashboard" },
  { role: "Merchant admin", email: "stepforward.finpilot@example.com", entry: "/merchant/login → /merchant" },
];

export const DEMO_PASSWORD = "Demo@1234";

export const REPO_TREE = [
  { depth: 0, name: "apps/", note: "" },
  { depth: 1, name: "finpilot-web/", note: "Next.js — buyer app + merchant portal + these docs" },
  { depth: 2, name: "app/dashboard/", note: "buyer shell: chat, cart, orders, merchants" },
  { depth: 2, name: "app/merchant/", note: "merchant portal, own login and layout guard" },
  { depth: 2, name: "app/docs/", note: "this page" },
  { depth: 2, name: "components/ui/", note: "shadcn primitives" },
  { depth: 1, name: "finpilot-backend/", note: "FastAPI + the MCP server" },
  { depth: 2, name: "app/api/routes/", note: "16 routers — the whole HTTP surface" },
  { depth: 2, name: "app/services/", note: "the Merchant Checkout Core lives here" },
  { depth: 2, name: "app/mcp_server/", note: "standalone MCP process (app, auth, server, run)" },
  { depth: 2, name: "app/models/", note: "SQLAlchemy models" },
  { depth: 2, name: "app/seed/", note: "demo catalog data" },
  { depth: 2, name: "alembic/", note: "migrations" },
  { depth: 0, name: "docs/", note: "the markdown mirror of this page" },
  { depth: 0, name: "docker-compose.yml", note: "the whole stack — three services + Postgres" },
];

export const FRONTEND_ROUTES = [
  { path: "/login", audience: "public", purpose: "Buyer sign-in." },
  { path: "/dashboard", audience: "buyer", purpose: "Chat shopping assistant — the buyer agent's front end." },
  { path: "/dashboard/c/[conversationId]", audience: "buyer", purpose: "One conversation, with its full replayed history." },
  { path: "/dashboard/merchants", audience: "buyer", purpose: "Browse merchants and their catalogs." },
  { path: "/dashboard/products/[productId]", audience: "buyer", purpose: "Product detail, offer badge included." },
  { path: "/dashboard/cart", audience: "buyer", purpose: "Cart and multi-line checkout." },
  { path: "/dashboard/orders", audience: "buyer", purpose: "Orders with payment status and audit trail." },
  { path: "/merchant/login", audience: "public", purpose: "Merchant sign-in — a separate door entirely." },
  { path: "/merchant", audience: "merchant", purpose: "Store overview." },
  { path: "/merchant/products", audience: "merchant", purpose: "Catalog CRUD, image upload, raw prices." },
  { path: "/merchant/orders", audience: "merchant", purpose: "Orders from both front doors, with provenance." },
  { path: "/merchant/campaigns", audience: "merchant", purpose: "Campaign orchestrator: propose, approve, apply." },
  { path: "/merchant/ads", audience: "merchant", purpose: "Ad wallet top-ups and sponsored campaigns." },
  { path: "/merchant/agents", audience: "merchant", purpose: "Issue and revoke external agent API keys." },
  { path: "/merchant/accounts", audience: "merchant", purpose: "Payout/account settings." },
  { path: "/merchant/insights", audience: "merchant", purpose: "Revenue trend, campaign impact, ad impact." },
  { path: "/merchant/audit", audience: "merchant", purpose: "The growth-agent activity trail." },
  { path: "/docs", audience: "public", purpose: "This documentation." },
];

export const AGENT_TOOLS = [
  {
    name: "search_catalog",
    args: "query, max_price?, category?, limit?",
    note: "Caps at 20 results, defaults to 5. Categories are injected as prose, not a JSON-schema enum — an enum made Groq return 400 tool_use_failed on near-miss guesses and cost roughly 4× the tokens.",
  },
  { name: "get_product_detail", args: "product_id", note: "Full detail for one product, offer price included." },
  { name: "create_order", args: "product_id, quantity?", note: "Passes through the confirmation gate before it can do anything." },
  { name: "check_payment_status", args: "order_id", note: "Polls Razorpay when the webhook hasn't landed yet." },
  { name: "list_orders", args: "—", note: "The buyer's own orders, so the agent can answer 'where's my order'." },
];

export const PROMPT_RULES = [
  "Never call create_order without explicit confirmation.",
  "Never recommend outside the buyer's stated budget.",
  "Always show name, price and rating before asking to confirm.",
  "Never invent a product, price, or id.",
  "Ask at most one clarifying question.",
  "Don't pad search results — be precise about how many matched.",
  "Match variants (size, weight) rather than guessing one.",
  "Suggest add-ons only after a confirmed order, and never buy one silently.",
  "Don't restate what the UI already renders as a card.",
];

export const AUDIT_ACTIONS = [
  { action: "search_catalog", actor: "Both front doors", note: "Query, filters, and how many results came back." },
  { action: "get_product_detail", actor: "Buyer agent", note: "Which product was inspected." },
  { action: "create_order", actor: "Both front doors", note: "success, failed, or blocked — with the amount." },
  { action: "upsell_suggested", actor: "Buyer agent", note: "Cross-sell shown after a confirmed order." },
  { action: "check_payment_status", actor: "Both front doors", note: "Status reads, including polling fallbacks." },
  { action: "list_orders", actor: "Buyer agent", note: "Order-history reads inside a conversation." },
  { action: "payment_confirmed", actor: "Razorpay webhook", note: "Idempotent — a replayed webhook changes nothing." },
  { action: "payment_failed", actor: "Razorpay webhook", note: "Expiry, cancellation, or a declined attempt." },
  { action: "campaign_proposed", actor: "Campaign agent", note: "The full proposal payload, as computed." },
  { action: "campaign_approved / applied / ended / rejected", actor: "Merchant admin", note: "Who moved it, and when." },
  { action: "ad_wallet_topped_up", actor: "Razorpay webhook", note: "Credited once, on first confirmation only." },
  { action: "ad_campaign_created / paused / resumed / ended", actor: "Merchant admin", note: "Sponsored-campaign lifecycle." },
  { action: "ad_impression", actor: "Catalog service", note: "Logged where a sponsored result is actually shown — free." },
  { action: "ad_click_charged", actor: "Ads service", note: "The only ad action that moves money." },
];

export const INSIGHTS_METRICS = [
  { metric: "Overview", detail: "Total, paid, pending and failed orders, plus lifetime paid revenue." },
  { metric: "30-day trend", detail: "Daily paid orders and revenue — the window is capped so a new campaign still gets an equal-length comparison." },
  { metric: "Campaign impact", detail: "Paid orders for a campaign's own products, before vs. after it went live, in equal-length windows. Every campaign ever applied is included, not just the running ones." },
  { metric: "Ad impact", detail: "Impressions, clicks, spend, and the orders and revenue since — all reconstructed from the audit trail, with no separate tracking table." },
];

export const ENV_VARS = [
  { name: "DATABASE_URL", required: true, note: "Postgres connection string." },
  { name: "JWT_SECRET_KEY", required: true, note: "Signs access and refresh tokens." },
  { name: "GROQ_API_KEY", required: false, note: "Any one LLM provider key is enough; more keys mean more quota headroom." },
  { name: "NVIDIA_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY", required: false, note: "Whichever are present join the fallback chain." },
  { name: "PREFERRED_MODEL", required: false, note: "Promoted to the front of the chain across every provider serving it." },
  { name: "GROQ_MODELS / NVIDIA_MODELS / …", required: false, note: "Per-provider catalogs, so a renamed model is a config edit, not a code change." },
  { name: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET", required: false, note: "Omit to run against the built-in payment stub." },
  { name: "RAZORPAY_WEBHOOK_SECRET", required: false, note: "Unset accepts webhooks unverified — local dev only, and logged as such." },
  { name: "CORS_ORIGINS", required: true, note: "Allowed frontend origin(s)." },
  { name: "MCP_SERVER_PORT", required: false, note: "Port for the standalone MCP process (8100 locally)." },
];

export const GLOSSARY = [
  { term: "Paise", definition: "One hundredth of a rupee. Every monetary value in the system is an integer count of paise — never a float rupee amount — so discounts, budgets and wallet balances can't drift by rounding." },
  { term: "Spend envelope", definition: "The pre-authorized limits attached to an agent client: a maximum amount per order and a maximum number of orders per rolling day. Both are checked server-side before payment is created." },
  { term: "Mandate-lite", definition: "This project's stand-in for a full signed-mandate protocol: a merchant-issued API key that carries its own spend limits, rather than a cryptographic mandate the buyer signs per transaction." },
  { term: "Front door", definition: "One of the two independent entry paths into the same core — the buyer chat loop, and the MCP server for external agents." },
  { term: "Merchant Checkout Core", definition: "The shared service layer (catalog, pricing, orders, audit) that both front doors call. It's the reason a guarantee only has to be implemented once." },
  { term: "Effective price", definition: "A product's price after any applied campaign discount, computed on read. The catalog's own price_paise is never mutated by a campaign." },
  { term: "Idempotency key", definition: "A unique-indexed string that makes a repeated create-order call return the original order instead of creating a second one." },
  { term: "Recall rule", definition: "The word-boundary matching that decides whether a product is relevant to a query. Sponsored results must pass exactly the same rule as organic ones." },
  { term: "Quota bucket", definition: "One (provider, model) pair in the LLM fallback chain, tracked separately — an exhausted model doesn't imply an exhausted provider." },
];

export const DECISIONS = [
  {
    question: "Why is the campaign agent deterministic instead of an LLM?",
    answer:
      "Because a discount is money. The proposals are arithmetic over the merchant's own 90-day paid-order history, so every number in a proposal can be traced to the rows that produced it — and the margin floor is enforced in code, not requested in a prompt.",
  },
  {
    question: "Why does the MCP server run as its own process?",
    answer:
      "It keeps the two front doors' failure modes and scaling independent while still sharing one codebase — the MCP process imports the same services rather than calling the FastAPI app over HTTP, so there's no second copy of the rules and no extra network hop.",
  },
  {
    question: "Why is there no hard spend cap on the human chat path?",
    answer:
      "A human buyer is present for every purchase and confirms each one explicitly, so the gate is the confirmation, not a cap. An external agent has no human in the loop at that moment, which is exactly why its envelope is enforced in code.",
  },
  {
    question: "Why store the Razorpay payment-link id in razorpay_order_id?",
    answer:
      "The integration uses the Payment Links API rather than the bare Orders API, because a plain order has no hosted checkout page for a buyer to pay on. The column name predates that decision; the value in it is a plink_… id.",
  },
  {
    question: "Why isn't an organic product view tracked?",
    answer:
      "It would mean writing an audit row for every result of every search, for products nobody paid to promote. Sponsored impressions are tracked because someone is being billed against them; campaign impact is answered from paid-order history instead.",
  },
  {
    question: "What is deliberately out of scope?",
    answer:
      "Refunds and returns, multi-currency, real (non-test-mode) payments, shipping and logistics, and a full agent-mandate protocol with per-transaction signing. The audit trail is append-only but not cryptographically chained.",
  },
];
