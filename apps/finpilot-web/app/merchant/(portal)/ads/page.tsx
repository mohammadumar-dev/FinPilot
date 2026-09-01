"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ExternalLinkIcon, PauseIcon, PlayIcon, PlusIcon, TargetIcon, WalletIcon, XIcon } from "lucide-react";

import {
  ApiError,
  createAdCampaign,
  endAdCampaign,
  getAdWallet,
  listAdCampaigns,
  listMerchantProducts,
  pauseAdCampaign,
  resumeAdCampaign,
  topUpAdWallet,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AdCampaign, AdCampaignStatus, AdWallet, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function adErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detail = (err.body as { detail: unknown }).detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message);
    }
  }
  return fallback;
}

const CAMPAIGN_STATUS_STYLES: Record<AdCampaignStatus, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-warning/15 text-warning-foreground dark:text-warning",
  ended: "bg-muted text-muted-foreground",
};

export default function AdsPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;

  const [wallet, setWallet] = React.useState<AdWallet | null>(null);
  const [campaigns, setCampaigns] = React.useState<AdCampaign[] | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [toppingUp, setToppingUp] = React.useState(false);
  const [topupAmount, setTopupAmount] = React.useState("500");
  const [creating, setCreating] = React.useState(false);
  const [newCampaign, setNewCampaign] = React.useState({ productId: "", cpc: "2", dailyBudget: "100" });
  const [actingOn, setActingOn] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!merchantId) return;
    const [w, c, p] = await Promise.all([
      getAdWallet(merchantId),
      listAdCampaigns(merchantId),
      listMerchantProducts(merchantId),
    ]);
    setWallet(w);
    setCampaigns(c);
    setProducts(p);
  }, [merchantId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId) return;
    const rupees = Number(topupAmount);
    if (!Number.isFinite(rupees) || rupees <= 0) return;
    setToppingUp(true);
    try {
      const topup = await topUpAdWallet(merchantId, Math.round(rupees * 100));
      toast.success("Top-up created — complete payment to credit your wallet.");
      if (topup.payment_link) window.open(topup.payment_link, "_blank", "noopener,noreferrer");
      await refresh();
    } catch (err) {
      toast.error(adErrorMessage(err, "Couldn't start the top-up."));
    } finally {
      setToppingUp(false);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId || !newCampaign.productId) return;
    setCreating(true);
    try {
      await createAdCampaign(merchantId, {
        product_id: newCampaign.productId,
        cost_per_click_paise: Math.round(Number(newCampaign.cpc) * 100),
        daily_budget_paise: Math.round(Number(newCampaign.dailyBudget) * 100),
      });
      toast.success("Campaign created — it can now appear as Sponsored in matching searches.");
      setNewCampaign({ productId: "", cpc: "2", dailyBudget: "100" });
      await refresh();
    } catch (err) {
      toast.error(adErrorMessage(err, "Couldn't create the campaign."));
    } finally {
      setCreating(false);
    }
  }

  async function handleCampaignAction(action: "pause" | "resume" | "end", campaignId: string) {
    if (!merchantId) return;
    setActingOn(campaignId);
    try {
      const fn = action === "pause" ? pauseAdCampaign : action === "resume" ? resumeAdCampaign : endAdCampaign;
      await fn(merchantId, campaignId);
      await refresh();
    } catch (err) {
      toast.error(adErrorMessage(err, "That action didn't go through."));
    } finally {
      setActingOn(null);
    }
  }

  function productName(id: string) {
    return products.find((p) => p.id === id)?.name ?? "Unknown product";
  }

  const loading = wallet === null || campaigns === null;

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Ads" />

      <PageBody width="default">
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Grow revenue"
              title="Ads"
              description="Boost a product into matching buyer searches, tagged Sponsored. Showing it is free — only a real click charges your ad wallet, bounded by cost-per-click and a daily budget."
            />

            {/* Wallet */}
            <div className="surface flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <WalletIcon className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Ad wallet balance</p>
                    <p className="numeric text-xl font-medium">
                      ₹{((wallet?.balance_paise ?? 0) / 100).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <form onSubmit={handleTopup} className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="topup" className="text-xs">
                      Top up (₹)
                    </Label>
                    <Input
                      id="topup"
                      type="number"
                      min={1}
                      className="w-28"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="brand" disabled={toppingUp}>
                    {toppingUp ? <Spinner className="size-4" /> : "Top up"}
                  </Button>
                </form>
              </div>

              {wallet && wallet.recent_topups.length > 0 && (
                <div className="flex flex-col divide-y divide-border/60 border-t border-border/60">
                  {wallet.recent_topups.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="numeric">₹{(t.amount_paise / 100).toLocaleString("en-IN")}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground capitalize">
                          {t.status}
                        </Badge>
                        {(t.status === "created" || t.status === "pending") && t.payment_link && (
                          <Button
                            size="xs"
                            variant="outline"
                            nativeButton={false}
                            render={<a href={t.payment_link} target="_blank" rel="noreferrer" />}
                          >
                            Pay now
                            <ExternalLinkIcon />
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create campaign */}
            <form onSubmit={handleCreateCampaign} className="surface flex flex-col gap-4 p-5">
              <p className="text-sm font-medium">New sponsored placement</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="product" className="text-xs">
                    Product
                  </Label>
                  <select
                    id="product"
                    className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                    value={newCampaign.productId}
                    onChange={(e) => setNewCampaign((s) => ({ ...s, productId: e.target.value }))}
                    required
                  >
                    <option value="">Select a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="cpc" className="text-xs">
                    Cost/click (₹)
                  </Label>
                  <Input
                    id="cpc"
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="w-28"
                    value={newCampaign.cpc}
                    onChange={(e) => setNewCampaign((s) => ({ ...s, cpc: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="daily" className="text-xs">
                    Daily budget (₹)
                  </Label>
                  <Input
                    id="daily"
                    type="number"
                    min={1}
                    className="w-28"
                    value={newCampaign.dailyBudget}
                    onChange={(e) => setNewCampaign((s) => ({ ...s, dailyBudget: e.target.value }))}
                  />
                </div>
                <Button type="submit" variant="brand" disabled={creating} className="self-end">
                  {creating ? <Spinner className="size-4" /> : <PlusIcon />}
                  Create
                </Button>
              </div>
            </form>

            {/* Campaign list */}
            {campaigns && campaigns.length === 0 ? (
              <Empty className="surface py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <TargetIcon />
                  </EmptyMedia>
                  <EmptyTitle>No ad campaigns yet</EmptyTitle>
                  <EmptyDescription>
                    Create one above to start boosting a product into matching buyer searches.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="surface overflow-hidden">
                {campaigns?.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{productName(c.product_id)}</span>
                        <Badge variant="outline" className={cn("border-transparent capitalize", CAMPAIGN_STATUS_STYLES[c.status])}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="numeric text-xs text-muted-foreground">
                        ₹{(c.cost_per_click_paise / 100).toLocaleString("en-IN")}/click · ₹
                        {(c.daily_budget_paise / 100).toLocaleString("en-IN")}/day budget
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingOn === c.id}
                          onClick={() => handleCampaignAction("pause", c.id)}
                        >
                          <PauseIcon />
                          Pause
                        </Button>
                      )}
                      {c.status === "paused" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingOn === c.id}
                          onClick={() => handleCampaignAction("resume", c.id)}
                        >
                          <PlayIcon />
                          Resume
                        </Button>
                      )}
                      {c.status !== "ended" && (
                        <ConfirmDialog
                          trigger={
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              disabled={actingOn === c.id}
                            >
                              <XIcon />
                              End
                            </Button>
                          }
                          title="End this ad campaign?"
                          description={`${productName(c.product_id)} stops appearing as Sponsored immediately. This can't be resumed — you'd create a new campaign to sponsor it again.`}
                          confirmLabel="End campaign"
                          destructive
                          onConfirm={() => handleCampaignAction("end", c.id)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
