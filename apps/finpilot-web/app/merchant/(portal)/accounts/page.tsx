"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRightIcon, LandmarkIcon, TargetIcon, WalletIcon } from "lucide-react";

import { getAdWallet, listAdCampaigns, listCampaigns, listMerchantOrders } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdCampaign, AdWallet, Campaign, Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

function LedgerStrip({
  entries,
}: {
  entries: { label: string; value: string; tone?: "default" | "warning" | "destructive" | "success" }[];
}) {
  return (
    <dl className="surface grid grid-cols-2 divide-border/70 sm:grid-cols-4 sm:divide-x">
      {entries.map((entry, i) => (
        <div
          key={entry.label}
          className={cn(
            "flex flex-col gap-1.5 px-4 sm:px-5 py-4",
            i < 2 && "border-b border-border/70 sm:border-b-0",
            i % 2 === 1 && "border-l border-border/70 sm:border-l-0"
          )}
        >
          <dt className="section-label">{entry.label}</dt>
          <dd
            className={cn(
              "numeric text-xl leading-none font-medium tabular-nums sm:text-2xl",
              entry.tone === "warning" && "text-warning",
              entry.tone === "destructive" && "text-destructive",
              entry.tone === "success" && "text-success"
            )}
          >
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function AccountsPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;

  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [wallet, setWallet] = React.useState<AdWallet | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [adCampaigns, setAdCampaigns] = React.useState<AdCampaign[]>([]);

  React.useEffect(() => {
    if (!merchantId) return;
    (async () => {
      const [ordersData, walletData, campaignsData, adCampaignsData] = await Promise.all([
        listMerchantOrders(merchantId),
        getAdWallet(merchantId),
        listCampaigns(merchantId),
        listAdCampaigns(merchantId),
      ]);
      setOrders(ordersData);
      setWallet(walletData);
      setCampaigns(campaignsData);
      setAdCampaigns(adCampaignsData);
    })();
  }, [merchantId]);

  const loading = orders === null || wallet === null;

  const stats = React.useMemo(() => {
    const list = orders ?? [];
    const paid = list.filter((o) => o.status === "paid");
    const revenuePaise = paid.reduce((sum, o) => sum + o.amount_paise, 0);
    const pending = list.filter((o) => o.status === "created" || o.status === "pending");
    const failed = list.filter((o) => o.status === "failed");

    // Ad spend isn't tracked as its own figure anywhere — derive it: every
    // paid top-up minus what's still sitting in the wallet is what's been
    // spent on clicks so far.
    const toppedUpPaise = (wallet?.recent_topups ?? [])
      .filter((t) => t.status === "paid")
      .reduce((sum, t) => sum + t.amount_paise, 0);
    const adSpendPaise = Math.max(0, toppedUpPaise - (wallet?.balance_paise ?? 0));

    return {
      revenuePaise,
      orderCount: list.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      pendingPaise: pending.reduce((sum, o) => sum + o.amount_paise, 0),
      failedCount: failed.length,
      adSpendPaise,
      activeCampaigns: campaigns.filter((c) => c.status === "applied").length,
      activeAds: adCampaigns.filter((a) => a.status === "active").length,
    };
  }, [orders, wallet, campaigns, adCampaigns]);

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Accounts" />

      <PageBody width="wide">
        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Finance"
              title="Accounts"
              description="Revenue, ad spend, and the growth activity behind them — all in one place."
            />

            <LedgerStrip
              entries={[
                { label: "Total revenue", value: `₹${(stats.revenuePaise / 100).toLocaleString("en-IN")}`, tone: "success" },
                { label: "Orders", value: String(stats.orderCount) },
                {
                  label: "Awaiting payment",
                  value: `₹${(stats.pendingPaise / 100).toLocaleString("en-IN")}`,
                  tone: stats.pendingCount > 0 ? "warning" : "default",
                },
                {
                  label: "Ad spend",
                  value: `₹${(stats.adSpendPaise / 100).toLocaleString("en-IN")}`,
                },
              ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Orders breakdown */}
              <div className="surface flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <LandmarkIcon className="size-4" />
                    Orders breakdown
                  </p>
                  <Link
                    href="/merchant/orders"
                    className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    View all
                    <ArrowRightIcon className="size-3" />
                  </Link>
                </div>
                <dl className="flex flex-col divide-y divide-border/60">
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="numeric font-medium text-success">{stats.paidCount}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <dt className="text-muted-foreground">Awaiting payment</dt>
                    <dd className="numeric font-medium text-warning">{stats.pendingCount}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <dt className="text-muted-foreground">Failed</dt>
                    <dd className="numeric font-medium text-destructive">{stats.failedCount}</dd>
                  </div>
                </dl>
              </div>

              {/* Ad wallet */}
              <div className="surface flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <WalletIcon className="size-4" />
                    Ad wallet
                  </p>
                  <Link
                    href="/merchant/ads"
                    className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    Manage
                    <ArrowRightIcon className="size-3" />
                  </Link>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Current balance</span>
                  <span className="numeric text-xl font-medium">
                    ₹{((wallet?.balance_paise ?? 0) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
                  <span className="text-sm text-muted-foreground">Active sponsored placements</span>
                  <span className="numeric text-sm font-medium">{stats.activeAds}</span>
                </div>
                {wallet && wallet.recent_topups.length > 0 && (
                  <div className="flex flex-col divide-y divide-border/60 border-t border-border/60 pt-1">
                    {wallet.recent_topups.slice(0, 3).map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2 text-xs">
                        <span className="numeric">₹{(t.amount_paise / 100).toLocaleString("en-IN")}</span>
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground capitalize">
                            {t.status}
                          </Badge>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Campaigns summary */}
            <div className="surface flex items-center justify-between p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <TargetIcon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{stats.activeCampaigns} campaign(s) live</p>
                  <p className="text-xs text-muted-foreground">
                    {campaigns.length} proposed in total, discounting buyers see automatically.
                  </p>
                </div>
              </div>
              <Link
                href="/merchant/campaigns"
                className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                View campaigns
                <ArrowRightIcon className="size-3" />
              </Link>
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}
