"use client";

import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  BotIcon,
  KeyRoundIcon,
  LayersIcon,
  ListChecksIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TargetIcon,
  WebhookIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DocsTopbar } from "@/components/docs/docs-topbar";
import { DocsToc, useActiveSection, type DocsTocGroup } from "@/components/docs/docs-toc";
import { DocsSection, DocsSubsection } from "@/components/docs/docs-section";
import { BackToTop } from "@/components/docs/back-to-top";
import { Callout } from "@/components/docs/callout";
import { CodeBlock, CopyableValue } from "@/components/docs/code-block";
import { ApiExplorer } from "@/components/docs/api-explorer";
import { DecisionList, DefinitionList, RefTable, RepoTree } from "@/components/docs/reference-blocks";
import { EntityGrid } from "@/components/docs/entity-grid";
import { TechStackChart } from "@/components/docs/tech-stack-chart";
import { SpendEnvelopeChart } from "@/components/docs/spend-envelope-chart";
import { ArchitectureDiagram } from "@/components/docs/diagrams/architecture-diagram";
import { AgentLoopDiagram } from "@/components/docs/diagrams/agent-loop-diagram";
import { McpSequenceDiagram } from "@/components/docs/diagrams/mcp-sequence-diagram";
import { OrderLifecycleDiagram } from "@/components/docs/diagrams/order-lifecycle-diagram";
import { CampaignStateDiagram } from "@/components/docs/diagrams/campaign-state-diagram";
import { AdsFlowDiagram } from "@/components/docs/diagrams/ads-flow-diagram";
import { ErDiagram } from "@/components/docs/diagrams/er-diagram";
import { LlmChainDiagram } from "@/components/docs/diagrams/llm-chain-diagram";
import { useRevealGroup } from "@/lib/docs/use-reveal";
import { ENDPOINT_GROUPS, MCP_ERROR_CODES, MCP_TOOLS } from "@/lib/docs/endpoints-data";
import {
  AGENT_TOOLS,
  AUDIT_ACTIONS,
  DECISIONS,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  ENV_VARS,
  FRONTEND_ROUTES,
  GLOSSARY,
  INSIGHTS_METRICS,
  PROMPT_RULES,
} from "@/lib/docs/reference-data";

const TOC_GROUPS: DocsTocGroup[] = [
  {
    label: "Start here",
    items: [
      { id: "overview", label: "Overview" },
      { id: "quick-start", label: "Run it locally" },
      { id: "architecture", label: "System architecture" },
      { id: "repo-map", label: "Repository map" },
    ],
  },
  {
    label: "Data & flows",
    items: [
      { id: "data-model", label: "Data model" },
      { id: "order-lifecycle", label: "Order & payment" },
      { id: "frontend-routes", label: "Frontend routes" },
    ],
  },
  {
    label: "The four agents",
    items: [
      { id: "buyer-agent", label: "Buyer-agent loop" },
      { id: "llm-gateway", label: "LLM gateway" },
      { id: "mcp-agent", label: "External agents (MCP)" },
      { id: "campaign-agent", label: "Campaign orchestrator" },
      { id: "ads-agent", label: "Ads agent" },
      { id: "insights", label: "Merchant insights" },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "security", label: "Security & guardrails" },
      { id: "audit-trail", label: "Audit trail" },
      { id: "api-reference", label: "API reference" },
      { id: "tech-stack", label: "Tech stack" },
      { id: "runtime", label: "Runtime & config" },
      { id: "decisions", label: "Design decisions" },
      { id: "glossary", label: "Glossary" },
    ],
  },
];

const ENDPOINT_COUNT = ENDPOINT_GROUPS.reduce((sum, group) => sum + group.endpoints.length, 0);

const CAPABILITIES = [
  {
    icon: MessagesSquareIcon,
    title: "Chat shopping agent",
    body: "Finds the best-rated option inside a stated budget and places the order — one explicit confirmation past where the buyer agreed.",
    href: "#buyer-agent",
  },
  {
    icon: BotIcon,
    title: "Agent checkout over MCP",
    body: "Any external AI agent can browse and buy with a scoped, revocable key bounded by a spend envelope.",
    href: "#mcp-agent",
  },
  {
    icon: MegaphoneIcon,
    title: "Campaign orchestrator",
    body: "Reads 90 days of a merchant's paid orders and proposes discounts and bundles — deterministically, with a margin floor.",
    href: "#campaign-agent",
  },
  {
    icon: TargetIcon,
    title: "Ads agent",
    body: "A prepaid wallet, a relevance-gated sponsored slot, and a click charge bounded by cost-per-click and a daily budget.",
    href: "#ads-agent",
  },
  {
    icon: ListChecksIcon,
    title: "Full audit trail",
    body: "Every search, order, payment, campaign and ad action — successes, failures and blocks alike — in one append-only table.",
    href: "#audit-trail",
  },
  {
    icon: ShieldCheckIcon,
    title: "Enforced server-side",
    body: "Price, stock and budget are re-derived on every path, every time. Nothing money-shaped is ever trusted from a caller.",
    href: "#security",
  },
];

export default function DocsPage() {
  const activeId = useActiveSection(TOC_GROUPS);
  const heroRef = useRevealGroup<HTMLDivElement>(110);

  return (
    <>
      <DocsTopbar groups={TOC_GROUPS} activeId={activeId} />
      <BackToTop />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/70">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-secondary/70 via-secondary/20 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand/10 blur-3xl"
        />
        <div ref={heroRef} className="relative mx-auto max-w-[1400px] px-4 py-12 sm:px-6 sm:py-16">
          <div data-reveal-item className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <SparkleIcon className="size-3" /> Open source · MIT
            </Badge>
            <Badge variant="outline">Agentic commerce</Badge>
          </div>
          <h1 data-reveal-item className="font-heading mt-4 max-w-3xl text-4xl sm:text-5xl">
            How FinPilot actually works
          </h1>
          <p data-reveal-item className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            FinPilot is an AI shopping agent that finds the best-rated option within a budget and buys it — through a
            chat UI for human buyers, and through a standard MCP interface for any external AI agent. Every action is
            bounded by a spend envelope, gated behind explicit confirmation, and logged to a full audit trail. This
            page documents the system that makes that true: its architecture, its data model, and exactly how each of
            its four agents decides what to do.
          </p>
          <div data-reveal-item className="mt-7 grid grid-cols-2 gap-3 sm:max-w-2xl md:grid-cols-4">
            <HeroStat label="Front doors" value="2" hint="chat UI · MCP" />
            <HeroStat label="Agents" value="4" hint="buyer · external · campaign · ads" />
            <HeroStat label="HTTP endpoints" value={String(ENDPOINT_COUNT)} hint="one shared core" />
            <HeroStat label="MCP tools" value={String(MCP_TOOLS.length)} hint="search · order · status" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-10 px-4 py-6 sm:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100svh-6rem)] overflow-y-auto pb-8">
            <DocsToc groups={TOC_GROUPS} activeId={activeId} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 divide-y divide-border/70">
          {/* ------------------------------------------------ Start here */}
          <DocsSection
            id="overview"
            eyebrow="01 · Start here"
            title="One core, two front doors"
            description="Two multi-tenant apps share one backend — the Merchant Checkout Core. A human buyer reaches it through a Next.js chat UI; an external AI agent reaches it through an MCP server with a scoped API key. Both paths call the identical catalog, pricing, order and audit services, so a discount, a stock check or a spend cap behaves exactly the same way regardless of who — or what — is buying."
          >
            <CapabilityGrid />
            <Callout tone="tip" title="The one idea worth taking away" className="mt-4">
              Every guarantee in this system is implemented once, in the shared core, and both front doors inherit it.
              That&rsquo;s why an order placed by an AI nobody on this team built is subject to precisely the same stock
              re-check, campaign pricing, idempotency and audit logging as one placed by a human in the chat UI.
            </Callout>
          </DocsSection>

          <DocsSection
            id="quick-start"
            eyebrow="02 · Start here"
            title="Run it locally"
            description="Two processes and a Postgres database."
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CodeBlock
                title="1 · backend — apps/finpilot-backend"
                code={`python -m venv .venv
.venv\\Scripts\\activate      # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
# create .env from .env.example, then:
alembic upgrade head
python -m app.seed.seed_data
uvicorn app.main:app --reload --port 8000

# optional: the MCP front door, its own process
python -m app.mcp_server.run   # :8100`}
              />
              <CodeBlock
                title="2 · frontend — apps/finpilot-web"
                code={`echo NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 > .env.local
npm install
npm run dev                    # :3000`}
              />
            </div>

            <DocsSubsection
              title="Demo accounts"
              description="Buyer and merchant are separate doors — a buyer login is redirected out of the merchant portal, and vice versa."
            >
              <RefTable
                columns={["Role", "Email", "Where it lands"]}
                rows={DEMO_ACCOUNTS.map((account) => [
                  account.role,
                  <CopyableValue key={account.email} value={account.email} />,
                  <code key={`${account.email}-entry`} className="numeric">
                    {account.entry}
                  </code>,
                ])}
                monoColumn={null}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Password for every demo account: <CopyableValue value={DEMO_PASSWORD} />
              </p>
            </DocsSubsection>

            <Callout tone="note" title="No Razorpay keys? It still runs." className="mt-6">
              With no live credentials configured, the payment service returns a stubbed order id and a dead local URL
              instead of a real payment link — so order creation, the audit trail and every dashboard remain fully
              exercisable. Test mode also caps an account at 30 payment links ever; when that&rsquo;s exhausted the same
              stub takes over, and only ever on a <code className="numeric">rzp_test_</code> key.
            </Callout>
          </DocsSection>

          <DocsSection
            id="architecture"
            eyebrow="03 · Start here"
            title="System architecture"
            description="Both front doors terminate in the same core, and only the core touches Postgres or Razorpay. Nothing about pricing, stock, budget or idempotency is duplicated between the two paths — it lives once."
          >
            <ArchitectureDiagram />
            <DocsSubsection title="What runs where">
              <RefTable
                columns={["Process", "Responsibility", "Port"]}
                rows={[
                  [
                    "finpilot-web",
                    "Next.js app serving the buyer shell, the merchant portal and these docs.",
                    "3000",
                  ],
                  [
                    "finpilot-backend",
                    "FastAPI: auth, catalog, cart, orders, the buyer-agent chat loop, the growth agents, and the Razorpay webhook receiver.",
                    "8000",
                  ],
                  [
                    "MCP server",
                    "Standalone uvicorn process exposing three tools over streamable HTTP. Imports the backend's services as a library — same code, no extra network hop.",
                    "8100",
                  ],
                  ["PostgreSQL", "Every table. Money is integer paise; every state machine is a CHECK constraint.", "5432"],
                ]}
              />
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="repo-map"
            eyebrow="04 · Start here"
            title="Repository map"
            description="Where each thing described on this page actually lives on disk."
          >
            <RepoTree />
          </DocsSection>

          {/* ------------------------------------------------ Data & flows */}
          <DocsSection
            id="data-model"
            eyebrow="05 · Data & flows"
            title="Data model"
            description="Ten SQLAlchemy models, migrated with Alembic. The orders table is the interesting one: it serves both front doors, distinguished by which of two mutually exclusive identity columns is populated."
          >
            <ErDiagram />
            <DocsSubsection title="Every table" description="Key columns and the constraint that makes each one trustworthy.">
              <EntityGrid />
            </DocsSubsection>
            <Callout tone="guard" title="Money is never a float" className="mt-6">
              Every monetary value — prices, discounts, spend caps, wallet balances, ad budgets — is an integer count of
              paise. A discount is <code className="numeric">round(price_paise * (100 - pct) / 100)</code>, not a
              floating-point multiply, so repeated reads can&rsquo;t drift and a wallet can&rsquo;t end up owing a
              fraction of a paisa.
            </Callout>
          </DocsSection>

          <DocsSection
            id="order-lifecycle"
            eyebrow="06 · Data & flows"
            title="Order & payment lifecycle"
            description="An order's status is never set by a client. It moves when Razorpay says so — through the signature-verified webhook, or through the polling fallback that runs when the webhook hasn't arrived."
          >
            <OrderLifecycleDiagram />

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <InfoCard icon={WebhookIcon} title="Webhook, with a fallback that actually works">
                The receiver is HMAC-verified against <code className="numeric">RAZORPAY_WEBHOOK_SECRET</code> and
                idempotent — a replayed event changes nothing. When no secret is configured it accepts unverified
                events and logs that it did, which is a deliberate local-dev affordance, not a default to ship. If the
                webhook never arrives, <code className="numeric">check_payment_status</code> polls Razorpay directly and
                persists any change, so a buyer is never left staring at &ldquo;pending&rdquo;.
              </InfoCard>
              <InfoCard icon={LayersIcon} title="Idempotency by database, not by memory">
                A unique index on <code className="numeric">idempotency_key</code> is what makes a duplicate impossible
                — not an in-process guard that a second worker wouldn&rsquo;t see. Razorpay&rsquo;s own{" "}
                <code className="numeric">reference_id</code> is deliberately a fresh UUID rather than derived from that
                key, because Razorpay requires it unique forever while a buyer may legitimately retry a failed order for
                the same product.
              </InfoCard>
            </div>

            <DocsSubsection title="How each path keys an order">
              <RefTable
                columns={["Path", "Key shape", "On retry"]}
                rows={[
                  [
                    "Buyer chat",
                    "chat:{user_id}:{product_id}",
                    "An open order is returned as-is with its existing payment link; a previously failed one is reactivated in place rather than duplicated.",
                  ],
                  [
                    "External agent",
                    "agent:{agent_client_id}:{key}",
                    "Same key and same product returns the original order. Same key against a different product is rejected as duplicate_order.",
                  ],
                ]}
              />
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="frontend-routes"
            eyebrow="07 · Data & flows"
            title="Frontend routes"
            description="One Next.js app, two independent shells with symmetric layout guards: a merchant admin is redirected out of the buyer app, and a buyer out of the merchant portal."
          >
            <RefTable
              columns={["Route", "Audience", "Purpose"]}
              rows={FRONTEND_ROUTES.map((route) => [route.path, route.audience, route.purpose])}
            />
          </DocsSection>

          {/* ------------------------------------------------ Agents */}
          <DocsSection
            id="buyer-agent"
            eyebrow="08 · The four agents"
            title="Buyer-agent chat loop"
            description="A tool-calling loop that turns a conversational request into a placed order — and can only ever get one explicit step past where the buyer actually agreed to buy something."
          >
            <AgentLoopDiagram />

            <DocsSubsection title="The five tools" description="Rebuilt fresh each turn, with up to 12 tool-call iterations before the turn is summarised and handed back.">
              <RefTable
                columns={["Tool", "Arguments", "Notes"]}
                rows={AGENT_TOOLS.map((tool) => [tool.name, tool.args, tool.note])}
              />
            </DocsSubsection>

            <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="surface p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <BotIcon className="size-4 text-brand" /> The system prompt is rules, not persona
                </h3>
                <ul className="mt-2.5 space-y-1.5">
                  {PROMPT_RULES.map((rule) => (
                    <li key={rule} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                      <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="surface p-4">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheckIcon className="size-4 text-brand" /> The confirmation gate, precisely
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  A message counts as confirmation only after negations are ruled out first, and either it matches an
                  explicit affirmative, or it&rsquo;s a short non-question reply to a purchase question the agent{" "}
                  <em>actually asked</em> — which is what lets a bare &ldquo;all&rdquo; or &ldquo;the men&rsquo;s
                  one&rdquo; count as an answer without letting a passing remark do so.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Confirmation alone still isn&rsquo;t enough. <code className="numeric">create_order</code> also
                  requires that this exact product id already appeared in this conversation&rsquo;s own search, detail
                  or upsell results. The phrase match had false positives; the shown-product check is what actually
                  closes the hole.
                </p>
              </div>
            </div>

            <DocsSubsection
              title="Upsell, held to the same standard"
              description="After a confirmed order, the agent may offer up to three same-category add-ons drawn from the catalog — never invented."
            >
              <Callout tone="guard" title="A suggestion is not a purchase">
                A suggested add-on is logged as <code className="numeric">upsell_suggested</code> and becomes orderable
                only through the identical gate: the buyer has to separately and explicitly confirm that specific item.
                Being shown as a suggestion is what satisfies the &ldquo;previously shown&rdquo; half of the gate — it
                never satisfies the confirmation half.
              </Callout>
            </DocsSubsection>

            <DocsSubsection title="Keeping a long conversation affordable">
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                Every turn replays the whole conversation, so tool results are compacted to identity fields only —
                product id, name, price, rating, merchant, category, variant — before being handed back to the model.
                If a provider returns an empty completion with no tool calls, that model is penalised and the turn is
                retried twice; if it still fails, the agent answers from a deterministic summary of what the tools
                actually returned rather than from nothing at all.
              </p>
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="llm-gateway"
            eyebrow="09 · The four agents"
            title="LLM gateway & fallback chain"
            description="Four interchangeable providers behind one client. Groq, NVIDIA NIM, OpenRouter and Gemini all speak the OpenAI chat-completions API, so a single client talks to all of them — and to any other endpoint that speaks the same dialect. Configure any combination: losing a provider costs capacity, never availability."
          >
            <Callout tone="tip" title="Why four providers instead of one" className="mb-6">
              A single-provider agent inherits that provider&rsquo;s outages, rate limits, pricing changes and
              deprecations as its own. FinPilot depends on none of the four. Because they share the OpenAI
              chat-completions contract, a provider is a row of configuration — a base URL, a key and a model list —
              not an integration. Adding a fifth, swapping to a self-hosted OpenAI-compatible endpoint, or dropping
              one entirely is a config edit, not a code change.
            </Callout>

            <DocsSubsection title="The four providers, and anything else that speaks the same protocol">
              <RefTable
                columns={["Provider", "Role in the chain"]}
                rows={[
                  [
                    "Groq",
                    "Lowest-latency tool-calling, so it usually leads the chain. Its published free-tier limits are the one set of quotas modelled locally, because they are documented precisely enough to trust.",
                  ],
                  [
                    "NVIDIA NIM",
                    "A broad catalogue of open-weight models behind an OpenAI-compatible endpoint — the widest model variety in the chain.",
                  ],
                  [
                    "OpenRouter",
                    "A gateway in front of many upstream vendors, which makes it the widest single fallback: one key reaches models this app never integrated directly.",
                  ],
                  [
                    "Gemini",
                    "Google's models through their OpenAI-compatibility layer — a provider on entirely separate infrastructure from the other three, which is the point of including it.",
                  ],
                  [
                    "Any OpenAI-compatible endpoint",
                    "vLLM, Ollama, a private inference cluster or another hosted vendor — a base URL, a key and a model list join the same chain with no code change.",
                  ],
                ]}
                monoColumn={null}
              />
            </DocsSubsection>

            <LlmChainDiagram />
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <InfoCard icon={LayersIcon} title="Every pair is its own bucket">
                A model being exhausted doesn&rsquo;t mean the account is, let alone the provider. Each
                (provider, model) pair tracks its own requests and tokens against that bucket&rsquo;s published limits.
              </InfoCard>
              <InfoCard icon={ScaleIcon} title="Proactive skip, reactive truth">
                A bucket known to be full is skipped before the call is made; the API&rsquo;s own 429/413 responses then
                override the local estimate, because the API always wins. Where a provider publishes nothing reliable,
                the bucket carries no local caps at all — better to be told than to invent numbers.
              </InfoCard>
              <InfoCard icon={ArrowRightIcon} title="Interleaved, not drained">
                Ranks round-robin across providers. Draining one provider&rsquo;s catalogue first would mean every retry
                after a stall lands on that same provider&rsquo;s smallest, least reliable models.
              </InfoCard>
            </div>
            <Callout tone="note" title="Only tool-calling chat models are eligible" className="mt-4">
              Transcription models, prompt-injection classifiers, safety-classification variants and provider-native
              agentic systems with their own built-in tools are deliberately excluded from the chain — layering this
              app&rsquo;s tool schema on top of a provider&rsquo;s own is untested, and those endpoints publish a
              different quota shape than the rest of the chain assumes.
            </Callout>
          </DocsSection>

          <DocsSection
            id="mcp-agent"
            eyebrow="10 · The four agents"
            title="External agents, over MCP"
            description="Any MCP client — not just FinPilot's own UI — can browse and buy through the Agent Checkout MCP server, authenticated with a merchant-issued scoped API key rather than a buyer's JWT."
          >
            <McpSequenceDiagram />

            <DocsSubsection title="The three tools">
              <div className="surface divide-y divide-border/60 overflow-hidden">
                {MCP_TOOLS.map((tool) => (
                  <div key={tool.name} className="p-4">
                    <code className="numeric text-xs font-semibold text-brand">{tool.name}</code>
                    <p className="numeric mt-1 text-[11px] break-all text-muted-foreground">{tool.signature}</p>
                    <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">{tool.purpose}</p>
                  </div>
                ))}
              </div>
            </DocsSubsection>

            <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <InfoCard icon={KeyRoundIcon} title="Authentication">
                A pure-ASGI middleware in front of the MCP transport bcrypt-verifies the bearer key against every
                non-revoked client on <em>every</em> request — revocation is never cached, so a revoked key fails on its
                very next call. The resolved identity travels in a ContextVar because MCP tools run outside
                FastAPI&rsquo;s dependency injection and can&rsquo;t take a <code className="numeric">Depends()</code>.
              </InfoCard>
              <InfoCard icon={ScaleIcon} title="The spend envelope">
                Before Razorpay is contacted, the core re-reads price and stock, then checks the order total against{" "}
                <code className="numeric">max_order_amount_paise</code> and the last 24 hours&rsquo; order count against{" "}
                <code className="numeric">max_orders_per_day</code>. Exceeding either is a typed tool result, not an
                exception the agent has to interpret.
              </InfoCard>
            </div>

            <DocsSubsection title="Connecting a client">
              <CodeBlock
                title="streamable HTTP + bearer key"
                code={`# 1 · Issue a key in the merchant portal → /merchant/agents
#     The plaintext fp_live_… key is shown exactly once.

# 2 · Point any MCP client at the server:
#     endpoint: http://localhost:8100/mcp
#     header:   Authorization: Bearer fp_live_…

# 3 · The three tools appear: search_catalog, create_order,
#     check_payment_status — scoped to that merchant only.`}
              />
            </DocsSubsection>

            <DocsSubsection title="Error codes" description="Returned as ordinary tool results so an agent can reason about them. The two marked as blocked are recorded that way in the audit trail.">
              <RefTable
                columns={["Code", "Meaning", "Audit outcome"]}
                rows={MCP_ERROR_CODES.map((error) => [
                  error.code,
                  error.meaning,
                  error.blocked ? "blocked" : "failed",
                ])}
              />
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="campaign-agent"
            eyebrow="11 · The four agents"
            title="Campaign orchestrator"
            description="Deterministic, not LLM-based — every discount it proposes is exactly as explainable as arithmetic, because it is arithmetic, over the merchant's own 90-day paid-order history."
          >
            <CampaignStateDiagram />

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="surface p-4">
                <h3 className="text-sm font-medium">How a proposal is computed</h3>
                <ol className="mt-2.5 space-y-2">
                  {[
                    "Aggregate paid orders per product over the last 90 days.",
                    "Split into best sellers (has revenue) and slow movers (zero paid orders, including never-sold).",
                    "Take up to 5 slow movers and assign a discount by price tier.",
                    "Cap that discount so the price still clears cost plus a 5% margin — where cost is on file.",
                    "Pair each with a same-category best seller as a bundle partner, if one exists.",
                  ].map((step, i) => (
                    <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
                      <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">
                  Fewer than 3 paid orders in the window and it refuses outright with{" "}
                  <code className="numeric">insufficient_order_history</code> rather than guessing.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <RefTable
                  columns={["Product price", "Proposed discount"]}
                  rows={[
                    ["≥ ₹500", "20%"],
                    ["≥ ₹200", "15%"],
                    ["below ₹200", "10%"],
                  ]}
                  monoColumn={null}
                />
                <Callout tone="guard" title="The margin floor wins">
                  If <code className="numeric">cost_price_paise</code> is on file, the tier discount is reduced until
                  the post-discount price clears cost plus 5% — and if the margin is already too thin, the proposed
                  discount is simply 0%. Cost price is never exposed to a buyer or an agent; it exists server-side for
                  exactly this check.
                </Callout>
              </div>
            </div>

            <DocsSubsection title="How an applied discount reaches a buyer">
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                A campaign never writes to <code className="numeric">Product.price_paise</code>. Applied campaigns whose
                optional window covers now are collected at read time and folded into the price by{" "}
                <code className="numeric">get_effective_price</code> — which is consulted at every price-surfacing
                point: buyer search, related products, product detail, the merchant&rsquo;s buyer-facing listing, and
                order creation on <em>both</em> the chat and MCP paths. The merchant&rsquo;s own product-management
                screens deliberately show the raw, undiscounted price instead.
              </p>
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="ads-agent"
            eyebrow="12 · The four agents"
            title="Ads agent"
            description="A merchant funds a real Razorpay test-mode wallet, then bids to get a product injected into matching buyer searches. Showing it is free; only a real click charges the wallet."
          >
            <AdsFlowDiagram />

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <InfoCard icon={TargetIcon} title="Relevance is not for sale">
                A sponsored candidate has to pass the same word-boundary recall rule as an organic result, have stock,
                and not already be ranked organically. Paid placement buys a slot, not a match.
              </InfoCard>
              <InfoCard icon={MegaphoneIcon} title="Prepended, never displacing">
                The winner — highest cost-per-click among eligible campaigns whose wallet covers that CPC — is prepended
                and tagged Sponsored. The top organic match keeps its place.
              </InfoCard>
              <InfoCard icon={ShieldCheckIcon} title="Two gates before a debit">
                A click re-derives cost server-side, then requires both a sufficient balance and that today&rsquo;s
                spend plus this click stays within the daily budget. Failing either is a silent no-op — never an error
                on the buyer&rsquo;s page.
              </InfoCard>
            </div>

            <Callout tone="note" title="Impressions are counted, and they're free" className="mt-4">
              The impression is logged in the catalog service — the single code path both the buyer chat agent and the
              MCP <code className="numeric">search_catalog</code> tool funnel through — so &ldquo;how many buyers saw
              this ad&rdquo; is a real count rather than an estimate, whichever front door did the searching.
            </Callout>
          </DocsSection>

          <DocsSection
            id="insights"
            eyebrow="13 · The four agents"
            title="Merchant insights"
            description="Whether the growth agents actually moved the needle — computed entirely from the audit trail and paid-order history, with no separate analytics table."
          >
            <RefTable
              columns={["Metric", "How it's computed"]}
              rows={INSIGHTS_METRICS.map((metric) => [metric.metric, metric.detail])}
              monoColumn={null}
            />
            <Callout tone="note" title="Why organic views aren't tracked" className="mt-4">
              Counting them would mean writing an audit row for every result of every search, for products nobody paid
              to promote. Sponsored impressions are tracked because someone is being billed against them; discount
              campaign impact is answered from paid-order history instead — did orders for a campaign&rsquo;s own
              products actually change after it went live, measured in equal-length windows either side.
            </Callout>
          </DocsSection>

          {/* ------------------------------------------------ Platform */}
          <DocsSection
            id="security"
            eyebrow="14 · Platform"
            title="Security & guardrails"
            description="No layer trusts a caller for anything money-shaped. Price, stock and budget are re-derived server-side on every path, every time."
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
              <GuardrailGrid />
              <div className="surface flex flex-col items-center justify-center p-4 sm:p-5">
                <SpendEnvelopeChart />
              </div>
            </div>

            <DocsSubsection title="Authentication at a glance">
              <RefTable
                columns={["Credential", "Used by", "Lifetime & revocation"]}
                rows={[
                  [
                    "Access token (JWT)",
                    "Buyer app and merchant portal",
                    "30 minutes. Persisted hashed alongside its refresh token.",
                  ],
                  [
                    "Refresh token (JWT)",
                    "Silent re-auth",
                    "7 days, individually revocable — the stored row carries a revoked flag.",
                  ],
                  [
                    "Agent client key",
                    "External MCP agents",
                    "No expiry; bcrypt-hashed at rest, shown once, and revoked in a way that fails closed on the next call.",
                  ],
                  [
                    "Webhook signature",
                    "Razorpay → backend",
                    "HMAC-verified per request. Unset secret accepts unverified events and logs it — local dev only.",
                  ],
                ]}
                monoColumn={null}
              />
            </DocsSubsection>

            <DocsSubsection title="Role separation">
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                <code className="numeric">role</code> is CHECK-constrained to <code className="numeric">buyer</code> or{" "}
                <code className="numeric">merchant_admin</code>. Every{" "}
                <code className="numeric">/merchant/&#123;merchant_id&#125;/…</code> endpoint requires the merchant-admin
                dependency <em>and</em> re-checks that the path&rsquo;s merchant id matches the admin&rsquo;s own — so a
                merchant admin can never read or write another merchant&rsquo;s catalog, orders, wallet or keys. The
                frontend enforces the same split with symmetric layout guards, but the server is what makes it true.
              </p>
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="audit-trail"
            eyebrow="15 · Platform"
            title="Audit trail"
            description="One append-only table every service writes to. It records what was attempted, not just what succeeded — which is what makes it useful when something was refused."
          >
            <RefTable
              columns={["Action", "Written by", "What it captures"]}
              rows={AUDIT_ACTIONS.map((entry) => [entry.action, entry.actor, entry.note])}
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <OutcomeCard outcome="success" body="The action completed and any money movement is real." />
              <OutcomeCard outcome="failed" body="It was attempted and errored — bad input, missing product, provider failure." />
              <OutcomeCard outcome="blocked" body="A guardrail refused it: no confirmation, over budget, or rate limited." />
            </div>
          </DocsSection>

          <DocsSection
            id="api-reference"
            eyebrow="16 · Platform"
            title="API reference"
            description="The full FastAPI surface, filterable. Auth column reads: public means no token at all, JWT means any signed-in user, merchant_admin additionally requires that the path's merchant is your own."
          >
            <ApiExplorer />
          </DocsSection>

          <DocsSection
            id="tech-stack"
            eyebrow="17 · Platform"
            title="Tech stack"
            description="FastAPI, SQLAlchemy and PostgreSQL on the backend; Next.js 16, React 19, Tailwind v4 and shadcn/ui on the frontend; a multi-provider LLM chain for the buyer agent, Razorpay for payments, and the MCP Python SDK for the external-agent front door."
          >
            <div className="surface p-4">
              <TechStackChart />
            </div>
            <DocsSubsection title="Why these, specifically">
              <RefTable
                columns={["Choice", "Reason"]}
                rows={[
                  [
                    "FastAPI + Pydantic",
                    "Validation and OpenAPI essentially for free — which matters when the same services are consumed by two very different front doors.",
                  ],
                  [
                    "PostgreSQL, not a document store",
                    "Orders, budgets and idempotency are exactly the relational-integrity problem that CHECK constraints, foreign keys and unique indexes exist for.",
                  ],
                  [
                    "Razorpay Payment Links",
                    "A bare order has no hosted checkout page; a buyer needs somewhere to actually pay.",
                  ],
                  [
                    "MCP as its own process",
                    "Independent failure modes and scaling, while still importing the same services — one codebase, one set of rules.",
                  ],
                  [
                    "Canvas for these diagrams",
                    "They redraw from live design tokens on every theme change, so the documentation can't drift from the palette the product actually ships.",
                  ],
                ]}
                monoColumn={null}
              />
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="runtime"
            eyebrow="18 · Platform"
            title="Runtime & configuration"
            description="Three stateless processes and one Postgres database. Each process ships as its own container image and holds no local state, so anything that can run a container and reach Postgres can run FinPilot — the system depends on no hosting provider, and nothing in the code knows where it is deployed."
          >
            <div className="surface divide-y divide-border/60">
              {[
                {
                  title: "Three stateless processes",
                  body: "The FastAPI core, the standalone MCP server and the Next.js frontend. No sticky sessions, no local disk, no in-memory state that outlives a request — every one of them is safe to run as several replicas or to restart at any moment.",
                },
                {
                  title: "One Postgres database",
                  body: "The single source of truth: catalog, orders, budgets, idempotency keys and the audit log. Plain PostgreSQL with no vendor extensions, reached over a standard connection string, so any Postgres — managed or self-hosted — works unchanged.",
                },
                {
                  title: "Configuration is entirely environment variables",
                  body: "Every provider key, database URL, CORS origin and service URL is read from the environment at startup. There is no host-specific config file baked into the application, and no code path branches on where it is running.",
                },
                {
                  title: "Payment events arrive over a public webhook",
                  body: "The only inbound requirement beyond HTTP: a publicly reachable HTTPS URL for /webhooks/razorpay. Without one, payment status still resolves through the polling fallback — the webhook makes it instant, it is not a dependency.",
                },
              ].map((item) => (
                <div key={item.title} className="p-4">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <Callout tone="tip" title="Portability is an architectural property here, not a deployment tip" className="mt-4">
              The same three images run under a local Compose file, on a laptop, or on any container platform, with the
              identical set of environment variables. That is the same principle the LLM layer follows with its four
              interchangeable providers — nothing in this system is bound to one vendor, because a system that can only
              run in one place has made an availability decision on the operator&rsquo;s behalf.
            </Callout>

            <DocsSubsection title="Environment variables">
              <RefTable
                columns={["Variable", "Required", "Notes"]}
                rows={ENV_VARS.map((variable) => [
                  variable.name,
                  variable.required ? "yes" : "optional",
                  variable.note,
                ])}
              />
            </DocsSubsection>
          </DocsSection>

          <DocsSection
            id="decisions"
            eyebrow="19 · Platform"
            title="Design decisions"
            description="The questions this architecture keeps getting asked, and what's deliberately not built."
          >
            <DecisionList items={DECISIONS} />
          </DocsSection>

          <DocsSection
            id="glossary"
            eyebrow="20 · Platform"
            title="Glossary"
            description="Terms this documentation uses precisely, and what each one means here."
          >
            <DefinitionList items={GLOSSARY} />
            <p className="mt-8 text-xs text-muted-foreground">
              A markdown mirror of everything on this page lives in <code className="numeric">docs/</code> at the
              repository root, one file per section.
            </p>
          </DocsSection>
        </main>
      </div>
    </>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="surface p-3.5">
      <p className="section-label">{label}</p>
      <p className="numeric mt-1 text-xl leading-none font-medium tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function CapabilityGrid() {
  const ref = useRevealGroup<HTMLDivElement>(60);
  return (
    <div ref={ref} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CAPABILITIES.map((capability) => (
        <a
          key={capability.title}
          href={capability.href}
          data-reveal-item
          className="surface-interactive group flex flex-col gap-2 p-4"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <capability.icon className="size-4" />
          </span>
          <span className="flex items-center gap-1 text-sm font-medium">
            {capability.title}
            <ArrowRightIcon className="size-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">{capability.body}</span>
        </a>
      ))}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="surface p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4 shrink-0 text-brand" />
        {title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

const GUARDRAILS = [
  { title: "Spend envelope", body: "A per-order cap and a daily order-count cap on every agent client, enforced before Razorpay is ever called." },
  { title: "Confirmation gate", body: "A human buyer's order needs both an affirmative answer to a purchase question and prior sight of that exact product." },
  { title: "Server-derived pricing", body: "Price and stock are re-read from the database at order time — never trusted from an agent's claim." },
  { title: "Idempotent by construction", body: "A unique database index, not an in-process check, so a retried call can't double-charge." },
  { title: "Merchant isolation", body: "Every merchant-scoped endpoint re-checks that the path's merchant is the caller's own." },
  { title: "Fail-closed revocation", body: "A revoked agent key is rejected on its very next call — checked fresh, never cached." },
  { title: "Margin floor on discounts", body: "A proposed discount can never push a price below cost plus a 5% margin where cost is known." },
  { title: "Append-only audit", body: "Successes, failures and refusals all land in one table, with the amount attached where money was involved." },
];

function GuardrailGrid() {
  const ref = useRevealGroup<HTMLUListElement>(45);
  return (
    <ul ref={ref} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {GUARDRAILS.map((guardrail) => (
        <li key={guardrail.title} data-reveal-item className="surface flex flex-col gap-1 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheckIcon className="size-3.5 shrink-0 text-brand" />
            {guardrail.title}
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">{guardrail.body}</span>
        </li>
      ))}
    </ul>
  );
}

const OUTCOME_STYLE = {
  success: "text-success",
  failed: "text-muted-foreground",
  blocked: "text-warning",
} as const;

function OutcomeCard({ outcome, body }: { outcome: keyof typeof OUTCOME_STYLE; body: string }) {
  return (
    <div className="surface p-3.5">
      <code className={`numeric text-xs font-semibold ${OUTCOME_STYLE[outcome]}`}>{outcome}</code>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
