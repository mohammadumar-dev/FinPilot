"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  PackageIcon,
  ReceiptIndianRupeeIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";

import { listMerchants, listMerchantProducts, listOrders, getOrderAuditTrail } from "@/lib/api";
import type { AuditLogEntry, Merchant, Order, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { AuditTrail } from "@/components/orders/audit-trail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "warning" | "destructive";
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-normal text-muted-foreground">{label}</CardTitle>
        <Icon
          className={cn(
            "size-4",
            tone === "warning" && "text-warning",
            tone === "destructive" && "text-destructive",
            tone === "default" && "text-brand"
          )}
        />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

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
  const rowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});

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
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-auto" />
        <h1 className="text-sm font-medium">Orders</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {orders === null ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Spinner className="size-5" />
          </div>
        ) : orders.length === 0 ? (
          <Empty className="mx-auto max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>No orders yet</EmptyTitle>
              <EmptyDescription>
                Start a chat and confirm a purchase — it&apos;ll show up here with its full receipt trail.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total orders" value={String(stats.total)} icon={PackageIcon} tone="default" />
              <StatCard label="Total spent" value={stats.totalSpent} icon={ReceiptIndianRupeeIcon} tone="default" />
              <StatCard label="Pending payment" value={String(stats.pending)} icon={ClockIcon} tone="warning" />
              <StatCard label="Failed" value={String(stats.failed)} icon={XCircleIcon} tone="destructive" />
            </div>
            <div className="overflow-hidden rounded-2xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Placed by</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const product = productFor(order.product_id);
                  const merchant = merchantFor(order.merchant_id);
                  const isExpanded = expanded === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <TableRow
                        ref={(el) => {
                          rowRefs.current[order.id] = el;
                        }}
                        role="button"
                        aria-expanded={isExpanded}
                        className={cn("cursor-pointer", deepLinkOrderId === order.id && "bg-brand/5")}
                        onClick={() => toggleExpand(order)}
                      >
                        <TableCell className="whitespace-normal">
                          <div className="flex flex-col">
                            <span className="font-medium">{product?.name ?? "Unknown product"}</span>
                            <span className="text-xs text-muted-foreground">{merchant?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.placed_by === "buyer_chat" ? "You (chat)" : "External agent"}
                        </TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>₹{(order.amount_paise / 100).toLocaleString("en-IN")}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <OrderStatusBadge status={order.status} />
                              {(order.status === "created" || order.status === "pending") && order.payment_link && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  nativeButton={false}
                                  onClick={(e) => e.stopPropagation()}
                                  render={<a href={order.payment_link} target="_blank" rel="noreferrer" />}
                                >
                                  Pay now
                                  <ExternalLinkIcon />
                                </Button>
                              )}
                            </div>
                            {order.status === "failed" && order.failure_reason && (
                              <span className="text-xs text-destructive">{order.failure_reason}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground" title={new Date(order.created_at).toLocaleString()}>
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <ChevronDownIcon
                            className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="whitespace-normal bg-muted/30 p-0">
                            {auditLoading === order.id ? (
                              <div className="flex items-center justify-center py-6 text-muted-foreground">
                                <Spinner className="size-4" />
                              </div>
                            ) : (
                              <AuditTrail entries={auditByOrder[order.id] ?? []} />
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
