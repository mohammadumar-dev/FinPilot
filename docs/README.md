# FinPilot documentation

This directory is the written reference for FinPilot — an AI shopping agent that finds the
best-rated option within a budget and buys it, through a chat UI for human buyers and through
a standard [MCP](https://modelcontextprotocol.io) interface for any external AI agent.

There's also an interactive version of most of this — with canvas diagrams and charts — at
**`/docs`** in the running frontend (`apps/finpilot-web`).

Built for the **Razorpay AI Buildathon — Track 1 (AI Growth & Agentic Commerce)**. The original
product/architecture plan is [`../agent-to-agent-checkout-final-plan.md`](../agent-to-agent-checkout-final-plan.md).

## Reading order

### Start here

| Doc | What's in it |
|---|---|
| [`architecture.md`](./architecture.md) | The system as a whole: the two front doors, the shared Merchant Checkout Core, the three processes, and how they fit together. |
| [`data-model.md`](./data-model.md) | Every table, its fields, and how they relate. |
| [`deployment.md`](./deployment.md) | Local dev quick start, and what any platform has to provide to run the three services. |

### The four agents

| Doc | What's in it |
|---|---|
| [`buyer-agent-workflow.md`](./buyer-agent-workflow.md) | The buyer-facing chat agent: its tool-calling loop, system prompt rules, and — precisely — how the confirmation gate works. |
| [`llm-gateway.md`](./llm-gateway.md) | The multi-provider fallback chain behind that agent: quota buckets, proactive skip vs. reactive 429s, and why ranks are interleaved. |
| [`mcp-protocol.md`](./mcp-protocol.md) | How an external AI agent authenticates and buys through the Agent Checkout MCP server, and how its spend cap/rate limit are enforced. |
| [`merchant-agents.md`](./merchant-agents.md) | The two merchant-growth agents: the campaign orchestrator (discount/bundle proposals) and the ads agent (sponsored placement). |

### Platform

| Doc | What's in it |
|---|---|
| [`order-payment-lifecycle.md`](./order-payment-lifecycle.md) | Order states, the Razorpay Payment Links integration, webhook verification, idempotency, and the polling fallback. |
| [`security.md`](./security.md) | Auth (JWT + roles), scoped agent-client API keys, and every server-side guardrail that money passes through. |
| [`audit-trail.md`](./audit-trail.md) | The single append-only table every service writes to — its action catalog and what `blocked` means. |
| [`insights.md`](./insights.md) | What the merchant dashboard computes, and why it's all reconstructed from the audit trail. |
| [`api-reference.md`](./api-reference.md) | Every HTTP endpoint, grouped by router, plus the 3 MCP tools. |
| [`tech-stack.md`](./tech-stack.md) | What's used where, and why. |
| [`decisions.md`](./decisions.md) | The trade-offs this architecture keeps getting asked about, and what's deliberately out of scope. |
| [`glossary.md`](./glossary.md) | Terms used precisely — paise, spend envelope, effective price, quota bucket. |

## The one-sentence architecture

Two independent front doors — a human buyer in the Next.js chat UI, and any external AI agent
over MCP with a scoped API key — both call the same Merchant Checkout Core (catalog, orders,
budget checks, audit log), so nothing about pricing, stock, or spend limits is duplicated or can
drift between the two paths.

```
Human buyer ──► Next.js chat UI ──► FastAPI (buyer-agent chat loop) ──┐
                                                                        ├──► Merchant Checkout Core ──► Postgres
External AI agent ──► MCP client (scoped API key) ──► MCP server ─────┘                            ──► Razorpay (test mode)
```
