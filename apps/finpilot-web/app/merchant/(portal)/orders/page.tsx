"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDownIcon, ExternalLinkIcon, PackageIcon } from "lucide-react";

import { getMerchantOrderAuditTrail, listMerchantOrders, listMerchantProducts } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuditLogEntry, Order, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuditTrail } from "@/components/orders/audit-trail";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

/** Same ledger-strip treatment as the buyer orders page — a spend record
 * reads as a single row of related numbers, not four competing boxes. */
function LedgerStrip({
  entries,
}: {
  entries: { label: string; value: string; tone?: "default" | "warning" | "destructive" }[];
}) {
  return (
    <dl className="surface grid grid-cols-2 divide-border/70 sm:grid-cols-4 sm:divide-x">
      {entries.map((entry, i) => (
        <div
          key={entry.label}
          className={cn(
            "flex flex-col gap-1.5 px-5 py-4",
            i < 2 && "border-b border-border/70 sm:border-b-0",
            i % 2 === 1 && "border-l border-border/70 sm:border-l-0"
          )}
        >
          <dt className="section-label">{entry.label}</dt>
          <dd
            className={cn(
              "numeric text-2xl leading-none font-medium",
              entry.tone === "warning" && "text-warning",
              entry.tone === "destructive" && "text-destructive"
            )}
          >
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const ORDER_GRID = "md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_3rem_6rem_11rem_8.5rem]";

export default function MerchantOrdersPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;

  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [auditByOrder, setAuditByOrder] = React.useState<Record<string, AuditLogEntry[]>>({});
  const [auditLoading, setAuditLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!merchantId) return;
    (async () => {
      const [ordersData, productsData] = await Promise.all([
        listMerchantOrders(merchantId),
        listMerchantProducts(merchantId),
      ]);
      setOrders(ordersData);
      setProducts(productsData);
    })();
  }, [merchantId]);

  function productFor(id: string) {
    return products.find((p) => p.id === id);
  }

  async function toggleExpand(order: Order) {
    if (expanded === order.id) {
      setExpanded(null);
      return;
    }
    setExpanded(order.id);
    if (!auditByOrder[order.id] && merchantId) {
      setAuditLoading(order.id);
      try {
        const entries = await getMerchantOrderAuditTrail(merchantId, order.id);
        setAuditByOrder((prev) => ({ ...prev, [order.id]: entries }));
      } finally {
        setAuditLoading(null);
      }
    }
  }

  const stats = React.useMemo(() => {
    const list = orders ?? [];
    const totalRevenuePaise = list
      .filter((o) => o.status === "paid")
      .reduce((sum, o) => sum + o.amount_paise, 0);
    const pending = list.filter((o) => o.status === "created" || o.status === "pending").length;
    const failed = list.filter((o) => o.status === "failed").length;
    return {
      total: list.length,
      totalRevenue: `₹${(totalRevenuePaise / 100).toLocaleString("en-IN")}`,
      pending,
      failed,
    };
  }, [orders]);

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Orders" />

      <PageBody width="wide">
        {orders === null ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : orders.length === 0 ? (
          <>
            <PageHeading eyebrow="Sales record" title="Orders" />
            <Empty className="surface py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>No orders yet</EmptyTitle>
                <EmptyDescription>
                  Every order placed against your catalog lands here — by a buyer in chat, or by an
                  external AI agent through your issued API key — with its full audit trail.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </>
        ) : (
          <>
            <PageHeading
              eyebrow="Sales record"
              title="Orders"
              description="Every order placed against your catalog, from any front door. Open a row to see the decision trail behind it."
            />

            <LedgerStrip
              entries={[
                { label: "Orders", value: String(stats.total) },
                { label: "Revenue", value: stats.totalRevenue },
                {
                  label: "Awaiting payment",
                  value: String(stats.pending),
                  tone: stats.pending > 0 ? "warning" : "default",
                },
                {
                  label: "Failed",
                  value: String(stats.failed),
                  tone: stats.failed > 0 ? "destructive" : "default",
                },
              ]}
            />

            <div className="surface overflow-hidden">
              <div
                className={cn(
                  "hidden items-center gap-4 border-b border-border/70 bg-muted/40 px-5 py-3 md:grid",
                  ORDER_GRID
                )}
              >
                <span className="section-label">Product</span>
                <span className="section-label">Placed by</span>
                <span className="section-label text-right">Qty</span>
                <span className="section-label text-right">Amount</span>
                <span className="section-label">Status</span>
                <span className="section-label text-right">Placed</span>
              </div>

              {orders.map((order) => {
                const product = productFor(order.product_id);
                const isExpanded = expanded === order.id;
                return (
                  <div key={order.id} className="border-b border-border/60 last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpand(order)}
                      className={cn(
                        "grid w-full grid-cols-2 items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-muted/40",
                        ORDER_GRID
                      )}
                    >
                      <span className="col-span-2 flex min-w-0 flex-col md:col-span-1">
                        <span className="truncate text-sm font-medium">
                          {product?.name ?? "Unknown product"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground md:hidden">
                          {order.placed_by === "buyer_chat" ? "Buyer, in chat" : "External agent"}
                          {order.quantity > 1 && ` · ×${order.quantity}`}
                        </span>
                      </span>

                      <span className="hidden text-sm text-muted-foreground md:block">
                        {order.placed_by === "buyer_chat" ? "Buyer, in chat" : "External agent"}
                      </span>

                      <span className="numeric hidden text-right text-sm text-muted-foreground md:block">
                        ×{order.quantity}
                      </span>

                      <span className="numeric text-right text-sm font-medium">
                        ₹{(order.amount_paise / 100).toLocaleString("en-IN")}
                      </span>

                      <span className="flex flex-col items-start gap-1">
                        <span className="flex items-center gap-2">
                          <OrderStatusBadge status={order.status} />
                          {(order.status === "created" || order.status === "pending") &&
                            order.payment_link && (
                              <Button
                                size="xs"
                                variant="outline"
                                nativeButton={false}
                                onClick={(e) => e.stopPropagation()}
                                render={
                                  <a href={order.payment_link} target="_blank" rel="noreferrer" />
                                }
                              >
                                Pay link
                                <ExternalLinkIcon />
                              </Button>
                            )}
                        </span>
                        {order.status === "failed" && order.failure_reason && (
                          <span className="text-xs text-destructive">{order.failure_reason}</span>
                        )}
                      </span>

                      <span className="col-span-2 flex items-center justify-end gap-3 md:col-span-1">
                        <span
                          className="text-xs whitespace-nowrap text-muted-foreground"
                          title={new Date(order.created_at).toLocaleString()}
                        >
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </span>
                        <ChevronDownIcon
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/30 px-5 py-4">
                        {auditLoading === order.id ? (
                          <div className="flex items-center justify-center py-6 text-muted-foreground">
                            <Spinner className="size-4" />
                          </div>
                        ) : (
                          <AuditTrail entries={auditByOrder[order.id] ?? []} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}
