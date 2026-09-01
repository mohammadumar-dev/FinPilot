"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { BotIcon, CheckIcon, CopyIcon, KeyRoundIcon, PlusIcon } from "lucide-react";

import { ApiError, createAgentClient, listAgentClients, revokeAgentClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AgentClient } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageBar, PageBody, PageHeading } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const detail = (err.body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export default function AgentsPage() {
  const { user } = useAuth();
  const merchantId = user?.merchant_id ?? null;

  const [clients, setClients] = React.useState<AgentClient[] | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", maxOrderAmount: "5000", maxOrdersPerDay: "10" });
  const [actingOn, setActingOn] = React.useState<string | null>(null);
  // The one-time plaintext key from the most recent issuance — shown once,
  // never retrievable again after this state is gone.
  const [justIssued, setJustIssued] = React.useState<{ name: string; apiKey: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!merchantId) return;
    setClients(await listAgentClients(merchantId));
  }, [merchantId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantId) return;
    setCreating(true);
    try {
      const created = await createAgentClient(merchantId, {
        name: form.name.trim(),
        max_order_amount_paise: Math.round(Number(form.maxOrderAmount) * 100),
        max_orders_per_day: Math.round(Number(form.maxOrdersPerDay)),
      });
      setJustIssued({ name: created.name, apiKey: created.api_key });
      setForm({ name: "", maxOrderAmount: "5000", maxOrdersPerDay: "10" });
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't issue a new key."));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(clientId: string) {
    if (!merchantId) return;
    setActingOn(clientId);
    try {
      await revokeAgentClient(merchantId, clientId);
      toast.success("API key revoked — it stops working immediately.");
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, "That action didn't go through."));
    } finally {
      setActingOn(null);
    }
  }

  async function copyKey() {
    if (!justIssued) return;
    try {
      await navigator.clipboard.writeText(justIssued.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the key manually.");
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <PageBar label="AI Agents" />

      <PageBody width="default">
        {clients === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Agentic commerce"
              title="AI Agents"
              description="Scoped API keys for external AI buyer agents to check out from your catalog directly — no chat UI involved. Every order they place is bounded by the spend limits below and shows up in your Orders alongside everything else."
            />

            {justIssued && (
              <div className="surface flex flex-col gap-3 border-2 border-brand/40 p-5">
                <div className="flex items-center gap-2">
                  <KeyRoundIcon className="size-4 text-brand" />
                  <p className="text-sm font-medium">
                    API key for &quot;{justIssued.name}&quot; — save this now, it won&apos;t be shown again
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="numeric flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
                    {justIssued.apiKey}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyKey}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="self-start" onClick={() => setJustIssued(null)}>
                  Done
                </Button>
              </div>
            )}

            <form onSubmit={handleCreate} className="surface flex flex-col gap-4 p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <PlusIcon className="size-4" />
                Issue a new key
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="name" className="text-xs">
                    Agent name
                  </Label>
                  <Input
                    id="name"
                    required
                    placeholder="e.g. Claude Desktop, Judge Demo Agent"
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="maxOrderAmount" className="text-xs">
                    Max order amount (₹)
                  </Label>
                  <Input
                    id="maxOrderAmount"
                    type="number"
                    min={1}
                    value={form.maxOrderAmount}
                    onChange={(e) => setForm((s) => ({ ...s, maxOrderAmount: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="maxOrdersPerDay" className="text-xs">
                    Max orders / day
                  </Label>
                  <Input
                    id="maxOrdersPerDay"
                    type="number"
                    min={1}
                    value={form.maxOrdersPerDay}
                    onChange={(e) => setForm((s) => ({ ...s, maxOrdersPerDay: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" variant="brand" disabled={creating} className="self-start">
                {creating ? <Spinner className="size-4" /> : <KeyRoundIcon />}
                Issue key
              </Button>
            </form>

            {clients.length === 0 ? (
              <Empty className="surface py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BotIcon />
                  </EmptyMedia>
                  <EmptyTitle>No agent keys yet</EmptyTitle>
                  <EmptyDescription>
                    Issue one above to let an external AI agent buy from your catalog directly.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="surface overflow-hidden">
                {clients.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        {c.revoked && (
                          <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                            Revoked
                          </Badge>
                        )}
                      </div>
                      <p className="numeric text-xs text-muted-foreground">
                        ₹{(c.max_order_amount_paise / 100).toLocaleString("en-IN")} max/order ·{" "}
                        {c.max_orders_per_day} orders/day · issued{" "}
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!c.revoked && (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="outline" disabled={actingOn === c.id}>
                            Revoke
                          </Button>
                        }
                        title={`Revoke "${c.name}"?`}
                        description="This key stops working immediately — any agent using it will start getting an unauthorized error on its next call. This can't be undone; issue a new key if the agent needs access again."
                        confirmLabel="Revoke"
                        destructive
                        onConfirm={() => handleRevoke(c.id)}
                      />
                    )}
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
