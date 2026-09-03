"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ChevronDownIcon, ExternalLinkIcon, PackageIcon } from "lucide-react";

import { listMerchants, listMerchantProducts, listOrders, getOrderAuditTrail } from "@/lib/api";
import type { AuditLogEntry, Merchant, Order, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuditTrail } from "@/components/orders/audit-trail";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

/**
 * The ledger strip. Four figures on one ruled surface rather than four
 * floating stat cards — this is a spend record, and reading it as a single
 * row of related numbers is both more truthful and quieter than four boxes
 * competing for attention.
 */
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
            "flex min-w-0 flex-col gap-1.5 px-3 py-4 sm:px-5",
            // 2-up on mobile needs its own rules; sm:divide-x handles wide.
            i < 2 && "border-b border-border/70 sm:border-b-0",
            i % 2 === 1 && "border-l border-border/70 sm:border-l-0"
          )}
        >
          <dt className="section-label">{entry.label}</dt>
          <dd
            className={cn(
              "numeric text-xl leading-none font-medium tabular-nums sm:text-2xl",
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

/**
 * One grid template shared by the header and every row. These were two
 * independent grids with `auto` columns, which sized to their own content —
 * so the "Qty"/"Amount"/"Status" labels never lined up over their values.
 * Explicit track widths are what keep the columns honest.
 */
const ORDER_GRID =
  "lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_3rem_6rem_11rem_8.5rem]";

export default function OrdersPage() {
  return (
    <React.Suspense fallback={null}>
      <OrdersPageContent />
    </React.Suspense>
  );
}

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const deepLinkOrderId = searchParams.get("order");

  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [merchants, setMerchants] = React.useState<Merchant[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [auditByOrder, setAuditByOrder] = React.useState<Record<string, AuditLogEntry[]>>({});
  const [auditLoading, setAuditLoading] = React.useState<string | null>(null);
  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    (async () => {
      const [ordersData, merchantsData] = await Promise.all([listOrders(), listMerchants()]);
      setOrders(ordersData);
      setMerchants(merchantsData);
      const productLists = await Promise.all(merchantsData.map((m) => listMerchantProducts(m.id)));
      setProducts(productLists.flat());
    })();
  }, []);

  function productFor(id: string) {
    return products.find((p) => p.id === id);
  }

  function merchantFor(id: string) {
    return merchants.find((m) => m.id === id);
  }

  const expandOrder = React.useCallback(
    async (orderId: string) => {
      setExpanded(orderId);
      if (!auditByOrder[orderId]) {
        setAuditLoading(orderId);
        try {
          const entries = await getOrderAuditTrail(orderId);
          setAuditByOrder((prev) => ({ ...prev, [orderId]: entries }));
        } finally {
          setAuditLoading(null);
        }
      }
    },
    [auditByOrder]
  );

  async function toggleExpand(order: Order) {
    if (expanded === order.id) {
      setExpanded(null);
      return;
    }
    await expandOrder(order.id);
  }

  // Deep-link support: /dashboard/orders?order=<id> (used by the "View" action
  // on the chat's orders list) auto-expands and scrolls to that row.
  React.useEffect(() => {
    if (!deepLinkOrderId || orders === null) return;
    if (!orders.some((o) => o.id === deepLinkOrderId)) return;
    expandOrder(deepLinkOrderId);
    rowRefs.current[deepLinkOrderId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkOrderId, orders]);

  const stats = React.useMemo(() => {
    const list = orders ?? [];
    const totalSpentPaise = list
      .filter((o) => o.status === "paid")
      .reduce((sum, o) => sum + o.amount_paise, 0);
    const pending = list.filter((o) => o.status === "created" || o.status === "pending").length;
    const failed = list.filter((o) => o.status === "failed").length;
    return {
      total: list.length,
      totalSpent: `₹${(totalSpentPaise / 100).toLocaleString("en-IN")}`,
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
            <PageHeading eyebrow="Spend record" title="Orders" />
            <Empty className="surface py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageIcon />
                </EmptyMedia>
                <EmptyTitle>No orders yet</EmptyTitle>
                <EmptyDescription>
                  Every purchase FinPilot makes lands here with its full audit trail — what was
                  searched, what was chosen, and why.
                </EmptyDescription>
              </EmptyHeader>
              <div className="flex justify-center">
                <Button variant="brand" nativeButton={false} render={<Link href="/dashboard" />}>
                  Start shopping
                </Button>
              </div>
            </Empty>
          </>
        ) : (
          <>
            <PageHeading
              eyebrow="Spend record"
              title="Orders"
              description="Every order placed on your behalf — by you in chat, or by an external agent using your API key. Open a row to see the decision trail behind it."
            />

            <LedgerStrip
              entries={[
                { label: "Orders", value: String(stats.total) },
                { label: "Total spent", value: stats.totalSpent },
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

            {/* A ruled list rather than a <table>: each order is a record with
                an expandable trail, and rows need to hold a nested panel that
                table semantics make awkward to lay out. */}
            <div className="surface overflow-hidden">
              <div
                className={cn(
                  "hidden items-center gap-4 border-b border-border/70 bg-muted/40 px-3 py-3 sm:px-5 lg:grid",
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
                const merchant = merchantFor(order.merchant_id);
                const isExpanded = expanded === order.id;
                return (
                  <div
                    key={order.id}
                    ref={(el) => {
                      rowRefs.current[order.id] = el;
                    }}
                    className={cn(
                      "border-b border-border/60 last:border-b-0",
                      deepLinkOrderId === order.id && "bg-brand/[0.04]"
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpand(order)}
                      className={cn(
                        "grid w-full grid-cols-2 items-center gap-x-4 gap-y-2 px-3 py-4 sm:px-5 text-left transition-colors hover:bg-muted/40",
                        ORDER_GRID
                      )}
                    >
                      <span className="col-span-2 flex min-w-0 flex-col lg:col-span-1">
                        <span className="truncate text-sm font-medium">
                          {product?.name ?? "Unknown product"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {merchant?.name}
                          <span className="lg:hidden">
                            {" · "}
                            {order.placed_by === "buyer_chat" ? "You, in chat" : "External agent"}
                            {order.quantity > 1 && ` · ×${order.quantity}`}
                          </span>
                        </span>
                      </span>

                      {/* Who placed it and how many are secondary on a phone —
                          they fold into the product line rather than each
                          taking a row of their own. */}
                      <span className="hidden text-sm text-muted-foreground lg:block">
                        {order.placed_by === "buyer_chat" ? "You, in chat" : "External agent"}
                      </span>

                      <span className="numeric hidden text-right text-sm text-muted-foreground lg:block">
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
                                Pay now
                                <ExternalLinkIcon />
                              </Button>
                            )}
                        </span>
                        {order.status === "failed" && order.failure_reason && (
                          <span className="text-xs text-destructive">{order.failure_reason}</span>
                        )}
                      </span>

                      <span className="col-span-2 flex items-center justify-end gap-3 lg:col-span-1">
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
                      <div className="border-t border-border/60 bg-muted/30 px-3 py-4 sm:px-5">
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
