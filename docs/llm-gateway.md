# LLM gateway & fallback chain

`apps/finpilot-backend/app/services/llm_gateway.py`

Groq, NVIDIA NIM, OpenRouter and Gemini all speak the OpenAI chat-completions API, so one client
talks to all of them and they differ only in base URL, key and model ids. **Configure any
combination**: whichever keys are present form the chain, and the app only fails when none are.
Losing a provider — an outage, an expired key, an exhausted quota — costs capacity, never
availability.

## Why four providers, and not one

A single-provider agent inherits that provider's outages, rate limits, pricing changes and model
deprecations as its own. FinPilot depends on none of the four. Because they all share the OpenAI
chat-completions contract, a provider here is a **row of configuration** — a base URL, a key and
a model list — not an integration.

| Provider | Role in the chain |
|---|---|
| **Groq** | Lowest-latency tool-calling, so it usually leads the chain. Its published limits are the one set of quotas modelled locally, because they're documented precisely enough to trust. |
| **NVIDIA NIM** | A broad catalogue of open-weight models behind an OpenAI-compatible endpoint — the widest model variety in the chain. |
| **OpenRouter** | A gateway in front of many upstream vendors, which makes it the widest single fallback: one key reaches models this app never integrated directly. |
| **Gemini** | Google's models through their OpenAI-compatibility layer — a provider on entirely separate infrastructure from the other three, which is the point of including it. |
| **Anything OpenAI-compatible** | vLLM, Ollama, a private inference cluster or another hosted vendor: a base URL, a key and a model list join the same chain with no code change. |

Adding a fifth provider, swapping to a self-hosted endpoint, or dropping one entirely is a config
edit. That is the same independence principle the runtime follows — see
[`deployment.md`](./deployment.md).

## Quota buckets

Every `(provider, model)` pair is its own quota bucket (`ModelLimits`, keyed
`f"{provider}:{name}"`). A model being exhausted doesn't mean the account is, let alone the
provider, so the gateway:

- **tracks local usage** against each bucket's published limits — requests per minute/day and
  tokens per minute/day — and proactively skips a bucket it already knows is full;
- **reacts to the API's own responses** (429/413/5xx), which always win over the local estimate.

Where a provider publishes no usable per-model limits, its buckets carry **no local caps at all**
and rely entirely on the reactive path. That's deliberate — better to let the API tell us than to
invent numbers. Only Groq's documented free-tier limits are applied locally
(`30 rpm · 1000 rpd · 8k tpm · 200k tpd`), because they're the only ones measured rather than
assumed.

## The chain is interleaved, not drained

`_build_chain` round-robins **by rank**, not by provider:

```
rank 0:  groq/flagship   nvidia/flagship   openrouter/flagship   gemini/flagship
rank 1:  groq/fallback   nvidia/fallback   openrouter/fallback   gemini/fallback
rank 2:  groq/last       …                 …                     gemini/last
```

Falling through one provider's whole catalogue first would mean every retry after a stall lands
on that same provider's smaller, less reliable models. Alternating reaches a second provider's
flagship before dropping to anyone's fallback tier.

`PREFERRED_MODEL` is promoted to the front of the chain across every provider that serves it
(`_ordered_chain`). Keep it on a large model: the small ones return empty completions and
malformed tool calls on long multi-step turns.

## Configuration

Per-provider catalogs live in `.env`, so a renamed or newly available model is a config edit
rather than a code change:

```bash
GROQ_API_KEY=…            # any one key is enough; more keys = more headroom
NVIDIA_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=

PREFERRED_MODEL=gemini-3.5-flash-lite
GROQ_MODELS=openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b
NVIDIA_MODELS=…
OPENROUTER_MODELS=…
GEMINI_MODELS=…
```

## What is deliberately not in the chain

Only general-purpose, tool-calling-capable chat models belong here. Explicitly excluded from
Groq's catalogue, for example:

| Excluded | Why |
|---|---|
| `whisper-large-v3(-turbo)` | Audio transcription, not chat. |
| `meta-llama/llama-prompt-guard-2-*` | Prompt-injection classifiers, not chat. |
| `openai/gpt-oss-safeguard-20b` | A safety-classification variant, not a general chat/tool model. |
| `groq/compound`, `groq/compound-mini` | Provider-native agentic systems with their own built-in web-search/code-execution tools. Layering this app's tool schema on top of theirs is untested, and they publish no token limits — a different quota shape than the rest of the chain assumes. |

## Failure handling

- `chat_completion_with_fallback(messages, tools, tool_choice, temperature)` walks the ordered
  chain until a call succeeds, waiting at most `_MAX_CHAIN_WAIT_SECONDS` (12s) for a bucket to
  free up.
- A genuine bug — 400/401/403/404/422 — is **raised, never hidden behind a fallback**. The one
  exception is a retryable bad request such as Groq's `tool_use_failed`, which is treated as a
  model-specific failure and falls through.
- `penalize_model(key, seconds)` cools a model down when it returns an empty completion, which is
  how the [buyer agent](./buyer-agent-workflow.md) reacts to a model quitting mid-task.
- `_retry_after_seconds` honours the provider's own `Retry-After` when present.

See [`buyer-agent-workflow.md`](./buyer-agent-workflow.md) for how a turn behaves when the whole
chain is unavailable: the agent falls back to a deterministic summary of what its tools actually
returned, rather than to nothing at all.
