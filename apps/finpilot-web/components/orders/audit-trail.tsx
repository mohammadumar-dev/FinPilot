import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/lib/types";

const OUTCOME_DOT: Record<string, string> = {
  success: "bg-success",
  blocked: "bg-warning",
  failed: "bg-destructive",
};

const ACTION_LABEL: Record<string, string> = {
  search_catalog: "Searched catalog",
  get_product_detail: "Looked up product detail",
  create_order: "Created order",
  check_payment_status: "Checked payment status",
  payment_confirmed: "Payment confirmed",
  payment_failed: "Payment failed",
};

export function AuditTrail({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">No audit entries for this order yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3 px-3 py-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span
            className={cn(
              "mt-1.5 size-2 shrink-0 rounded-full",
              OUTCOME_DOT[entry.outcome ?? ""] ?? "bg-muted-foreground"
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{ACTION_LABEL[entry.action] ?? entry.action}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
            {entry.reasoning && <p className="text-xs text-muted-foreground">{entry.reasoning}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
