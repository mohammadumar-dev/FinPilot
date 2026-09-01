"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowDownIcon, ArrowUpIcon, MegaphoneIcon, MinusIcon, MousePointerClickIcon, TargetIcon } from "lucide-react";

import { getMerchantInsights } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdImpact, CampaignImpact, MerchantInsights } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { RevenueTrendChart } from "@/components/insights/revenue-trend-chart";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

function LedgerStrip({ entries }: { entries: { label: string; value: string }[] }) {
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
          <dd className="numeric text-2xl leading-none font-medium">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Change indicator — never color alone (an icon + the number carry it),
 * and the direction is computed once so the icon/color/sign always agree. */
function DeltaBadge({ before, after }: { before: number; after: number }) {
  if (before === 0 && after === 0) {
    return <span className="text-xs text-muted-foreground">No orders in either window yet</span>;
  }
  if (before === 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-success">
        <ArrowUpIcon className="size-3" />
        New sales since launch
      </span>
    );
  }
  const pct = Math.round(((after - before) / before) * 100);
  if (pct === 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <MinusIcon className="size-3" />
        Unchanged
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", up ? "text-success" : "text-destructive")}>
      {up ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function CampaignImpactCard({ impact }: { impact: CampaignImpact }) {
  return (
    <article className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{impact.product_names.join(", ")}</p>
          <p className="text-xs text-muted-foreground">
            Went live {formatDistanceToNow(new Date(impact.applied_at), { addSuffix: true })} · {impact.window_days}-day
            before/after window
          </p>
        </div>
        <CampaignStatusBadge status={impact.status} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-3">
          <span className="text-[0.65rem] text-muted-foreground uppercase">Before</span>
          <span className="numeric text-lg font-medium">₹{(impact.before.revenue_paise / 100).toLocaleString("en-IN")}</span>
          <span className="numeric text-xs text-muted-foreground">{impact.before.orders} order(s)</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-brand/[0.06] p-3">
          <span className="text-[0.65rem] text-muted-foreground uppercase">After</span>
          <span className="numeric text-lg font-medium">₹{(impact.after.revenue_paise / 100).toLocaleString("en-IN")}</span>
          <span className="numeric text-xs text-muted-foreground">{impact.after.orders} order(s)</span>
        </div>
      </div>
      <DeltaBadge before={impact.before.revenue_paise} after={impact.after.revenue_paise} />
    </article>
  );
}

function AdImpactRow({ impact }: { impact: AdImpact }) {
  const roi = impact.spend_paise > 0 ? impact.revenue_since_paise / impact.spend_paise : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{impact.product_name}</span>
          <Badge
            variant="outline"
            className={cn(
              "border-transparent capitalize",
              impact.status === "active"
                ? "bg-success/15 text-success"
                : impact.status === "paused"
                  ? "bg-warning/15 text-warning-foreground dark:text-warning"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {impact.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Sponsoring since {formatDistanceToNow(new Date(impact.created_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-5 text-right">
        <div>
          <p className="numeric text-sm font-medium">{impact.impressions}</p>
          <p className="text-[0.65rem] text-muted-foreground uppercase">Seen by</p>
        </div>
        <div>
          <p className="numeric text-sm font-medium">
            {impact.clicks}
            {impact.impressions > 0 && (
              <span className="text-xs text-muted-foreground"> ({((impact.clicks / impact.impressions) * 100).toFixed(0)}%)</span>
            )}
          </p>
          <p className="text-[0.65rem] text-muted-foreground uppercase">Clicks</p>
        </div>
        <div>
          <p className="numeric text-sm font-medium">₹{(impact.spend_paise / 100).toLocaleString("en-IN")}</p>
          <p className="text-[0.65rem] text-muted-foreground uppercase">Spend</p>
        </div>
        <div>
          <p className="numeric text-sm font-medium">
            {impact.orders_since} · ₹{(impact.revenue_since_paise / 100).toLocaleString("en-IN")}
          </p>
          <p className="text-[0.65rem] text-muted-foreground uppercase">Orders since</p>
        </div>
        <div>
          <p className={cn("numeric text-sm font-medium", roi != null && roi >= 1 ? "text-success" : undefined)}>
            {roi != null ? `${roi.toFixed(1)}×` : "—"}
          </p>
          <p className="text-[0.65rem] text-muted-foreground uppercase">Return</p>
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;
  const [insights, setInsights] = React.useState<MerchantInsights | null>(null);

  React.useEffect(() => {
    if (!merchantId) return;
    getMerchantInsights(merchantId).then(setInsights);
  }, [merchantId]);

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Insights" />

      <PageBody width="wide">
        {insights === null ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Full business growth"
              title="Insights"
              description="Whether the growth agent is actually working — paid orders before vs. after each campaign went live, and clicks-to-orders for every sponsored placement. Built from your real order and click history, not estimates."
            />

            <LedgerStrip
              entries={[
                { label: "Total orders", value: String(insights.overview.total_orders) },
                { label: "Paid revenue", value: `₹${(insights.overview.total_revenue_paise / 100).toLocaleString("en-IN")}` },
                { label: "Awaiting payment", value: String(insights.overview.pending_orders) },
                { label: "Failed", value: String(insights.overview.failed_orders) },
              ]}
            />

            <div className="surface flex flex-col gap-4 p-5">
              <p className="text-sm font-medium">Revenue — last 30 days</p>
              <RevenueTrendChart data={insights.trend} />
            </div>

            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <MegaphoneIcon className="size-4" />
                Campaign impact — sales before vs. after
              </p>
              {insights.campaign_impacts.length === 0 ? (
                <Empty className="surface py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MegaphoneIcon />
                    </EmptyMedia>
                    <EmptyTitle>No campaign has gone live yet</EmptyTitle>
                    <EmptyDescription>Apply one from Campaigns to start tracking its impact here.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {insights.campaign_impacts.map((impact) => (
                    <CampaignImpactCard key={impact.campaign_id} impact={impact} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <TargetIcon className="size-4" />
                Ad impact — clicks to orders
              </p>
              {insights.ad_impacts.length === 0 ? (
                <Empty className="surface py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MousePointerClickIcon />
                    </EmptyMedia>
                    <EmptyTitle>No ad campaigns yet</EmptyTitle>
                    <EmptyDescription>Create one from Ads to start tracking clicks and conversions.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="surface overflow-hidden">
                  {insights.ad_impacts.map((impact) => (
                    <AdImpactRow key={impact.ad_campaign_id} impact={impact} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}
