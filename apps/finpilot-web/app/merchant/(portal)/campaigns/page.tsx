"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, MegaphoneIcon, PencilIcon, SparklesIcon, SquareIcon, TagIcon } from "lucide-react";

import {
  ApiError,
  applyCampaign,
  approveCampaign,
  endCampaign,
  listCampaigns,
  proposeCampaign,
  rejectCampaign,
  updateCampaignSchedule,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Campaign } from "@/lib/types";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

/** Extracts the {code, message} pair the backend's CampaignError maps onto —
 * see app/api/routes/campaigns.py's _to_http_error, which nests it under
 * detail rather than a bare string. */
function campaignErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detail = (err.body as { detail: unknown }).detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message);
    }
  }
  return fallback;
}

function isExpired(c: Campaign): boolean {
  return c.status === "applied" && c.end_date != null && new Date(c.end_date) < new Date();
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** `new Date("2026-09-02")` (no time component) is parsed as UTC midnight,
 * not the merchant's local midnight — for anyone east of UTC that silently
 * pushes "starts today" hours into the future (and "ends" a day cuts most
 * of that day off instead of covering it). Appending a bare time-of-day
 * with no `Z`/offset makes `Date` parse it in the browser's local timezone
 * instead, so `.toISOString()` then converts *that* to the correct UTC
 * instant. */
function startOfDayLocalISO(dateInputValue: string): string {
  return new Date(`${dateInputValue}T00:00:00`).toISOString();
}
function endOfDayLocalISO(dateInputValue: string): string {
  return new Date(`${dateInputValue}T23:59:59.999`).toISOString();
}

// Access to this page is already gated one level up by app/merchant/layout.tsx
// (redirects anyone who isn't a signed-in merchant_admin) — no in-page
// access-check branch needed here.
export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = React.useState<Campaign[] | null>(null);
  const [proposing, setProposing] = React.useState(false);
  const [actingOn, setActingOn] = React.useState<string | null>(null);
  // Which campaign's date pickers are open, and whether that's the
  // one-time "Apply — go live" flow or editing an already-live schedule.
  const [schedulingId, setSchedulingId] = React.useState<string | null>(null);
  const [schedulingMode, setSchedulingMode] = React.useState<"apply" | "edit">("apply");
  const [scheduleDates, setScheduleDates] = React.useState({ start: "", end: "" });

  function closeScheduling() {
    setSchedulingId(null);
    setScheduleDates({ start: "", end: "" });
  }

  function startApplyScheduling(campaignId: string) {
    setSchedulingMode("apply");
    setScheduleDates({ start: "", end: "" });
    setSchedulingId(campaignId);
  }

  function startEditScheduling(c: Campaign) {
    setSchedulingMode("edit");
    setScheduleDates({ start: toDateInputValue(c.start_date), end: toDateInputValue(c.end_date) });
    setSchedulingId(c.id);
  }

  const merchantId = user?.merchant_id ?? null;

  const refresh = React.useCallback(async () => {
    if (!merchantId) return;
    setCampaigns(await listCampaigns(merchantId));
  }, [merchantId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handlePropose() {
    if (!merchantId) return;
    setProposing(true);
    try {
      await proposeCampaign(merchantId);
      toast.success("New campaign proposed from your recent order history.");
      await refresh();
    } catch (err) {
      toast.error(campaignErrorMessage(err, "Couldn't propose a campaign right now."));
    } finally {
      setProposing(false);
    }
  }

  async function handleApprove(campaignId: string) {
    if (!merchantId) return;
    setActingOn(campaignId);
    try {
      await approveCampaign(merchantId, campaignId);
      toast.success("Campaign approved.");
      await refresh();
    } catch (err) {
      toast.error(campaignErrorMessage(err, "That action didn't go through."));
    } finally {
      setActingOn(null);
    }
  }

  async function handleApply(campaignId: string) {
    if (!merchantId) return;
    setActingOn(campaignId);
    try {
      await applyCampaign(merchantId, campaignId, {
        start_date: scheduleDates.start ? startOfDayLocalISO(scheduleDates.start) : null,
        end_date: scheduleDates.end ? endOfDayLocalISO(scheduleDates.end) : null,
      });
      toast.success("Campaign is now live.");
      closeScheduling();
      await refresh();
    } catch (err) {
      toast.error(campaignErrorMessage(err, "That action didn't go through."));
    } finally {
      setActingOn(null);
    }
  }

  async function handleUpdateSchedule(campaignId: string) {
    if (!merchantId) return;
    setActingOn(campaignId);
    try {
      await updateCampaignSchedule(merchantId, campaignId, {
        start_date: scheduleDates.start ? startOfDayLocalISO(scheduleDates.start) : null,
        end_date: scheduleDates.end ? endOfDayLocalISO(scheduleDates.end) : null,
      });
      toast.success("Schedule updated.");
      closeScheduling();
      await refresh();
    } catch (err) {
      toast.error(campaignErrorMessage(err, "That action didn't go through."));
    } finally {
      setActingOn(null);
    }
  }

  async function handleReject(campaignId: string) {
    if (!merchantId) return;
    setActingOn(campaignId);
    try {
      await rejectCampaign(merchantId, campaignId);
      toast.success("Campaign rejected.");
      await refresh();
    } catch (err) {
      toast.error(campaignErrorMessage(err, "That action didn't go through."));
    } finally {
      setActingOn(null);
    }
  }

  async function handleEnd(campaignId: string) {
    if (!merchantId) return;
    setActingOn(campaignId);
    try {
      await endCampaign(merchantId, campaignId);
      toast.success("Campaign ended — buyers stop seeing this discount immediately.");
      await refresh();
    } catch (err) {
      toast.error(campaignErrorMessage(err, "That action didn't go through."));
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="Campaigns" />

      <PageBody width="default">
        {campaigns === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-40" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Grow revenue"
              title="Campaigns"
              description="Discount and bundle ideas generated from this merchant's own paid-order history — nothing here changes a price until you approve and apply it. Applied campaigns show as offers to buyers automatically, and can be scheduled or ended at any time."
              action={
                <Button variant="brand" onClick={handlePropose} disabled={proposing}>
                  {proposing ? (
                    <>
                      <Spinner className="size-4" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      Propose a campaign
                    </>
                  )}
                </Button>
              }
            />

            {campaigns.length === 0 ? (
              <Empty className="surface py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MegaphoneIcon />
                  </EmptyMedia>
                  <EmptyTitle>No campaigns yet</EmptyTitle>
                  <EmptyDescription>
                    Propose one to get discount/bundle ideas based on which of your products have
                    (and haven&apos;t) sold recently.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-4">
                {campaigns.map((c) => {
                  const expired = isExpired(c);
                  const isScheduling = schedulingId === c.id;
                  return (
                    <article key={c.id} className="surface flex flex-col gap-4 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <TagIcon className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium capitalize">{c.kind} campaign</span>
                            <CampaignStatusBadge status={c.status} expired={expired} />
                          </div>
                          <p className="text-sm text-muted-foreground">{c.proposal.summary}</p>
                          <p className="text-xs text-muted-foreground">
                            Proposed {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </p>
                          {(c.start_date || c.end_date) && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarIcon className="size-3" />
                              {c.start_date && `Starts ${new Date(c.start_date).toLocaleDateString()}`}
                              {c.start_date && c.end_date && " · "}
                              {c.end_date && `Ends ${new Date(c.end_date).toLocaleDateString()}`}
                            </p>
                          )}
                          {c.status === "ended" && c.ended_at && (
                            <p className="text-xs text-muted-foreground">
                              Ended {formatDistanceToNow(new Date(c.ended_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {c.status === "proposed" && (
                            <>
                              <ConfirmDialog
                                trigger={
                                  <Button size="sm" variant="outline" disabled={actingOn === c.id}>
                                    Reject
                                  </Button>
                                }
                                title="Reject this campaign?"
                                description="This proposal is discarded — you can always propose a fresh one from current order history."
                                confirmLabel="Reject"
                                destructive
                                onConfirm={() => handleReject(c.id)}
                              />
                              <Button
                                size="sm"
                                variant="brand"
                                disabled={actingOn === c.id}
                                onClick={() => handleApprove(c.id)}
                              >
                                Approve
                              </Button>
                            </>
                          )}
                          {c.status === "approved" && !isScheduling && (
                            <Button size="sm" variant="brand" onClick={() => startApplyScheduling(c.id)}>
                              Apply — go live
                            </Button>
                          )}
                          {c.status === "applied" && !expired && !isScheduling && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEditScheduling(c)}>
                                <PencilIcon />
                                Edit schedule
                              </Button>
                              <ConfirmDialog
                                trigger={
                                  <Button size="sm" variant="outline" disabled={actingOn === c.id}>
                                    <SquareIcon />
                                    End campaign
                                  </Button>
                                }
                                title="End this campaign?"
                                description="Buyers stop seeing this discount immediately — the price reverts to the regular catalog price on the next lookup."
                                confirmLabel="End campaign"
                                destructive
                                onConfirm={() => handleEnd(c.id)}
                              />
                            </>
                          )}
                          {expired && (
                            <ConfirmDialog
                              trigger={
                                <Button size="sm" variant="outline" disabled={actingOn === c.id}>
                                  Mark ended
                                </Button>
                              }
                              title="Mark this campaign ended?"
                              description="It already stopped discounting when its end date passed — this just closes it out in your records."
                              confirmLabel="Mark ended"
                              onConfirm={() => handleEnd(c.id)}
                            />
                          )}
                        </div>
                      </div>

                      {isScheduling && (
                        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-border p-4">
                          <div className="flex flex-col gap-1">
                            <Label htmlFor={`start-${c.id}`} className="text-xs">
                              Start date (optional)
                            </Label>
                            <Input
                              id={`start-${c.id}`}
                              type="date"
                              value={scheduleDates.start}
                              onChange={(e) => setScheduleDates((s) => ({ ...s, start: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor={`end-${c.id}`} className="text-xs">
                              End date (optional)
                            </Label>
                            <Input
                              id={`end-${c.id}`}
                              type="date"
                              value={scheduleDates.end}
                              onChange={(e) => setScheduleDates((s) => ({ ...s, end: e.target.value }))}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="brand"
                            disabled={actingOn === c.id}
                            onClick={() =>
                              schedulingMode === "apply" ? handleApply(c.id) : handleUpdateSchedule(c.id)
                            }
                          >
                            {actingOn === c.id ? (
                              <Spinner className="size-4" />
                            ) : schedulingMode === "apply" ? (
                              "Confirm — go live"
                            ) : (
                              "Save schedule"
                            )}
                          </Button>
                          <Button size="sm" variant="outline" onClick={closeScheduling}>
                            Cancel
                          </Button>
                          <p className="w-full text-xs text-muted-foreground">
                            Leave both blank to run indefinitely until you end it manually.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-col divide-y divide-border/60 border-t border-border/60">
                        {c.proposal.items.map((item) => (
                          <div key={item.product_id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">{item.product_name}</span>
                              <span className="numeric text-sm font-medium text-brand">
                                -{item.discount_pct}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
