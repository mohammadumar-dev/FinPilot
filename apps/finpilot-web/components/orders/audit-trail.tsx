import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/lib/types";

const OUTCOME_DOT: Record<string, string> = {
  success: "bg-success ring-success/20",
  blocked: "bg-warning ring-warning/20",
  failed: "bg-destructive ring-destructive/20",
};

const ACTION_LABEL: Record<string, string> = {
  search_catalog: "Searched catalog",
  get_product_detail: "Looked up product detail",
  create_order: "Created order",
  check_payment_status: "Checked payment status",
  payment_confirmed: "Payment confirmed",
  payment_failed: "Payment failed",
  upsell_suggested: "Suggested a related product",
  campaign_proposed: "Campaign proposed",
  campaign_approved: "Campaign approved",
  campaign_applied: "Campaign applied — went live",
  campaign_rejected: "Campaign rejected",
  campaign_ended: "Campaign ended",
  ad_campaign_created: "Ad campaign created",
  ad_campaign_paused: "Ad campaign paused",
  ad_campaign_resumed: "Ad campaign resumed",
  ad_campaign_ended: "Ad campaign ended",
  ad_wallet_topped_up: "Ad wallet topped up",
  ad_click_charged: "Sponsored click charged",
};

/** The decision trail behind an order. Drawn as a connected timeline rather
 * than a flat list — these entries are a sequence, and the rail is what says
 * so: each step led to the next, ending in a payment outcome. */
export function AuditTrail({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No trail recorded for this order yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="section-label">Decision trail</h3>
      <ol className="relative flex flex-col gap-4">
        {entries.map((entry, i) => (
          <li key={entry.id} className="relative flex gap-3.5">
            {/* Rail segment: drawn from this dot down to the next one, so the
                last entry doesn't trail a line into empty space. */}
            {i < entries.length - 1 && (
              <span
                aria-hidden
                className="absolute top-4 left-[3.5px] h-[calc(100%+0.5rem)] w-px bg-border"
              />
            )}
            <span
              className={cn(
                "relative mt-1.5 size-2 shrink-0 rounded-full ring-4",
                OUTCOME_DOT[entry.outcome ?? ""] ?? "bg-muted-foreground ring-muted-foreground/15"
              )}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {ACTION_LABEL[entry.action] ?? entry.action}
                </span>
                <span
                  className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
                  title={new Date(entry.created_at).toLocaleString()}
                >
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </div>
              {entry.reasoning && (
                <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                  {entry.reasoning}
                </p>
              )}
              {entry.amount_paise != null && (
                <p className="numeric text-xs text-muted-foreground">
                  ₹{(entry.amount_paise / 100).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
