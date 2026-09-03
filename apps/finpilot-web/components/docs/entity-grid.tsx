"use client";

import { useRevealGroup } from "@/lib/docs/use-reveal";

type Entity = {
  name: string;
  table: string;
  blurb: string;
  fields: string[];
};

const ENTITIES: Entity[] = [
  {
    name: "User",
    table: "users",
    blurb: "A buyer or a merchant_admin (role is CHECK-constrained). merchant_id is set only for admins.",
    fields: ["email (unique)", "password_hash", "role", "merchant_id?"],
  },
  {
    name: "Merchant",
    table: "merchants",
    blurb: "One seller. sku_prefix namespaces every product SKU it creates.",
    fields: ["slug (unique)", "sku_prefix", "razorpay_account_id?"],
  },
  {
    name: "Product",
    table: "products",
    blurb: "cost_price_paise is never exposed to buyers/agents — server-side only, used to floor campaign discounts.",
    fields: ["price_paise", "cost_price_paise?", "rating", "stock_quantity", "variant_group?"],
  },
  {
    name: "Order",
    table: "orders",
    blurb: "placed_by distinguishes the two front doors on one shared table. idempotency_key is uniquely indexed.",
    fields: ["status: created→pending→paid|failed", "placed_by: buyer_chat|external_agent", "agent_client_id?", "idempotency_key"],
  },
  {
    name: "CartItem",
    table: "cart_items",
    blurb: "One row per (user, product) — unique constraint keeps quantity upserts idempotent.",
    fields: ["user_id", "product_id", "quantity"],
  },
  {
    name: "Conversation / Message",
    table: "conversations · messages",
    blurb: "seq (an Identity column) — not created_at — is the authoritative message order; timestamps can collide within one transaction.",
    fields: ["role: user|agent|tool", "tool_call (JSONB)", "seq (unique)"],
  },
  {
    name: "AgentClient",
    table: "agent_clients",
    blurb: "A merchant-issued, scoped API key for one external AI agent — its spend envelope lives here.",
    fields: ["api_key_hash (bcrypt)", "max_order_amount_paise", "max_orders_per_day", "revoked"],
  },
  {
    name: "AuditLog",
    table: "audit_log",
    blurb: "One append-only trail every service writes to — search, order, payment, campaign, and ad events alike.",
    fields: ["action", "outcome: success|failed|blocked", "amount_paise?", "payload (JSONB)"],
  },
  {
    name: "Campaign",
    table: "campaigns",
    blurb: "A discount/bundle proposal. Never mutates Product.price_paise directly — discounts apply on read.",
    fields: ["status: proposed→approved→applied→ended", "kind: discount|bundle", "proposal (JSONB)"],
  },
  {
    name: "AdWallet / AdCampaign",
    table: "ad_wallets · ad_campaigns",
    blurb: "A prepaid balance plus one or more sponsored-placement campaigns bidding for search slots.",
    fields: ["balance_paise (≥0)", "cost_per_click_paise", "daily_budget_paise", "status: active|paused|ended"],
  },
];

export function EntityGrid() {
  const ref = useRevealGroup<HTMLDivElement>(50);
  return (
    <div ref={ref} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ENTITIES.map((e) => (
        <div key={e.name} data-reveal-item className="surface flex flex-col gap-2 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">{e.name}</h3>
            <code className="numeric text-[10px] text-muted-foreground">{e.table}</code>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{e.blurb}</p>
          <ul className="mt-auto flex flex-wrap gap-1 pt-1.5">
            {e.fields.map((f) => (
              <li key={f} className="numeric rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] text-foreground">
                {f}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
