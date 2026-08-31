"""Measure which models can actually drive FinPilot's agent loop.

Context length is not the deciding factor for this app — a turn is a few
thousand tokens — so a 1M-token window buys nothing. What decides it is
whether a model reliably emits a *valid* tool call against our real schema,
because every failure this agent has hit in production has been a tool-calling
failure: empty completions, and arguments the provider rejected.

This asks each provider which models it actually serves (no guessing at ids),
then gives each one the same job the agent does on turn one — a three-item
shopping list that must produce three search_catalog calls — and reports what
came back.

Usage, from apps/finpilot-backend:
    .venv/Scripts/python.exe -m scripts.probe_models                 # all providers
    .venv/Scripts/python.exe -m scripts.probe_models --provider nvidia
    .venv/Scripts/python.exe -m scripts.probe_models --models a,b    # specific ids
    .venv/Scripts/python.exe -m scripts.probe_models --limit 12
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass

from openai import OpenAI

sys.path.insert(0, ".")

from app.services.agent_service import _build_tools  # noqa: E402
from app.services.llm_gateway import PROVIDERS  # noqa: E402

# The turn that has broken most often in practice: three distinct items, each
# with its own budget, requiring three separate search_catalog calls.
PROBE_MESSAGES = [
    {
        "role": "system",
        "content": (
            "You are a shopping assistant. Use search_catalog to find products. "
            "Call it once per distinct item the buyer asks for."
        ),
    },
    {
        "role": "user",
        "content": (
            "Running shoes under 2000, wireless earbuds under 2500, "
            "and a book on habits under 500"
        ),
    },
]

# Substrings marking models that cannot serve this agent: vision/audio/embedding
# /reranking/guard models, and image generators. Cheaper to skip than to probe.
_NON_CHAT_HINTS = (
    "whisper", "embed", "rerank", "guard", "safeguard", "vision", "paligemma",
    "stable-diffusion", "flux", "clip", "ocr", "tts", "speech", "image",
    "moderation", "nemoretriever", "parakeet", "canary",
)


@dataclass
class Result:
    provider: str
    model: str
    ok: bool
    tool_calls: int
    valid_args: int
    latency_s: float
    tokens: int
    note: str

    @property
    def verdict(self) -> str:
        if not self.ok:
            return "unusable"
        if self.tool_calls == 0:
            return "no tools"
        if self.valid_args < self.tool_calls:
            return "bad args"
        if self.tool_calls >= 3:
            return "EXCELLENT"
        return "usable"


def _client(provider_name: str) -> OpenAI:
    provider = PROVIDERS[provider_name]
    return OpenAI(
        api_key=provider.api_key,
        base_url=provider.base_url,
        default_headers=provider.default_headers or None,
        max_retries=0,
        timeout=90.0,
    )


def list_models(provider_name: str) -> list[str]:
    try:
        models = _client(provider_name).models.list()
    except Exception as exc:  # noqa: BLE001 - report and continue to next provider
        print(f"  ! {provider_name}: could not list models ({type(exc).__name__}: {exc})")
        return []
    ids = [m.id for m in models.data]
    return [mid for mid in ids if not any(h in mid.lower() for h in _NON_CHAT_HINTS)]


def probe(provider_name: str, model: str, tools: list[dict]) -> Result:
    started = time.monotonic()
    try:
        response = _client(provider_name).chat.completions.create(
            model=model,
            messages=PROBE_MESSAGES,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
        )
    except Exception as exc:  # noqa: BLE001 - an unusable model is a result
        note = f"{type(exc).__name__}: {str(exc)[:90]}"
        return Result(provider_name, model, False, 0, 0, time.monotonic() - started, 0, note)

    elapsed = time.monotonic() - started
    choices = getattr(response, "choices", None)
    if not choices:
        # Seen from OpenRouter: HTTP 200 carrying an error payload shaped like
        # a completion, with choices null. Not a usable model for this agent.
        detail = getattr(response, "error", None) or "no choices in response"
        return Result(provider_name, model, False, 0, 0, elapsed, 0, str(detail)[:90])

    message = choices[0].message
    calls = list(getattr(message, "tool_calls", None) or [])

    valid = 0
    for call in calls:
        try:
            args = json.loads(call.function.arguments or "{}")
        except json.JSONDecodeError:
            continue
        # The schema's one required field. A call without it is unusable even
        # though the provider accepted it.
        if call.function.name == "search_catalog" and str(args.get("query", "")).strip():
            valid += 1

    tokens = getattr(getattr(response, "usage", None), "total_tokens", 0) or 0
    note = "" if calls else f"text-only: {(message.content or '')[:60]!r}"
    return Result(provider_name, model, True, len(calls), valid, elapsed, tokens, note)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", help="groq | nvidia | openrouter (default: all configured)")
    parser.add_argument("--models", help="comma-separated model ids to probe instead of discovering")
    parser.add_argument("--limit", type=int, default=25, help="max models per provider")
    args = parser.parse_args()

    if not PROVIDERS:
        print("No provider configured. Set GROQ_API_KEY, NVIDIA_API_KEY or OPENROUTER_API_KEY.")
        return 1

    names = [args.provider] if args.provider else sorted(PROVIDERS)
    unknown = [n for n in names if n not in PROVIDERS]
    if unknown:
        print(f"Not configured: {', '.join(unknown)}. Available: {', '.join(sorted(PROVIDERS))}")
        return 1

    tools = _build_tools_without_db()
    results: list[Result] = []

    for name in names:
        models = _split(args.models) if args.models else list_models(name)[: args.limit]
        if not models:
            continue
        print(f"\n{name} — probing {len(models)} model(s)")
        for model in models:
            result = probe(name, model, tools)
            results.append(result)
            detail = f"{result.tool_calls} calls, {result.valid_args} valid" if result.ok else result.note
            print(f"  {result.verdict:10} {model[:52]:54} {result.latency_s:5.1f}s  {detail}")

    _report(results)
    return 0


def _split(csv: str) -> list[str]:
    return [item.strip() for item in csv.split(",") if item.strip()]


def _build_tools_without_db() -> list[dict]:
    """The real agent tool schema, with the category list stubbed.

    _build_tools needs a DB session only to inline the category vocabulary;
    the probe cares about tool-calling mechanics, not catalogue contents.
    """

    class _StubDB:
        pass

    import app.services.catalog_service as catalog_service

    original = catalog_service.list_categories
    catalog_service.list_categories = lambda _db: ["footwear", "audio", "self-help"]
    try:
        return _build_tools(_StubDB())
    finally:
        catalog_service.list_categories = original


def _report(results: list[Result]) -> None:
    if not results:
        print("\nNothing probed.")
        return

    ranked = sorted(
        results,
        key=lambda r: (r.valid_args, -r.latency_s if r.ok else -9999),
        reverse=True,
    )
    print("\n" + "=" * 78)
    print("RANKED — most valid tool calls first, then fastest")
    print("=" * 78)
    print(f"{'verdict':11}{'provider':12}{'model':40}{'calls':>6}{'sec':>7}")
    for r in ranked[:20]:
        print(f"{r.verdict:11}{r.provider:12}{r.model[:38]:40}{r.valid_args:>6}{r.latency_s:>7.1f}")

    good = [r for r in ranked if r.ok and r.valid_args >= 3]
    if good:
        print("\nRecommended chain (handled all three items in one turn):")
        by_provider: dict[str, list[Result]] = {}
        for r in good:
            by_provider.setdefault(r.provider, []).append(r)
        for provider, rows in by_provider.items():
            env = {"groq": "GROQ_MODELS", "nvidia": "NVIDIA_MODELS", "openrouter": "OPENROUTER_MODELS"}[provider]
            print(f"  {env}={','.join(r.model for r in rows[:4])}")
    else:
        print("\nNo model completed all three searches in one turn.")


if __name__ == "__main__":
    raise SystemExit(main())
