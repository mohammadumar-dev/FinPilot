"""Multi-model Groq gateway with automatic "Auto Model" fallback.

Each Groq model has its own separate RPM/RPD/TPM/TPD quota bucket — a model
that's exhausted doesn't mean the account is, it means try the next model's
bucket. This module tracks local usage against each model's published limits
(proactive — skip a model we already know is full) and also reacts to the
API's own 429/413/5xx responses (authoritative — the API always wins over
our local estimate), falling through the chain until one call succeeds.

Only general-purpose, tool-calling-capable chat models belong in the chain.
Deliberately excluded:
  - whisper-large-v3(-turbo): audio transcription, not chat
  - meta-llama/llama-prompt-guard-2-*: prompt-injection classifiers, not chat
  - openai/gpt-oss-safeguard-20b: a safety-classification variant, not a
    general chat/tool-calling model
  - groq/compound, groq/compound-mini: Groq's own agentic systems with
    built-in web search/code-execution tools. Layering our own tool schema
    on top of theirs is untested, and they publish no token limits — a
    different quota shape than the rest of this chain assumes.
"""

import json
import logging
import re
import threading
import time
from collections import deque
from dataclasses import dataclass

from groq import APIConnectionError, APIStatusError, Groq, RateLimitError

from app.core.config import settings


@dataclass(frozen=True)
class ModelLimits:
    name: str
    rpm: int
    rpd: int
    tpm: int | None = None
    tpd: int | None = None


# Priority order: most capable first. A model is only skipped in favor of the
# next when it's locally estimated full or the API itself rejects the call.
MODEL_CHAIN: list[ModelLimits] = [
    ModelLimits("openai/gpt-oss-120b", rpm=30, rpd=1000, tpm=8000, tpd=200_000),
    ModelLimits("openai/gpt-oss-20b", rpm=30, rpd=1000, tpm=8000, tpd=200_000),
    ModelLimits("qwen/qwen3.8-27b", rpm=30, rpd=1000, tpm=8000, tpd=2_000_000_000),
    ModelLimits("qwen/qwen3.6-27b", rpm=30, rpd=1000, tpm=8000, tpd=200_000),
]

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {408, 413, 429, 500, 502, 503, 504}
_DEFAULT_COOLDOWN_SECONDS = 30.0

# A TPM rejection recovers in seconds, and Groq tells us exactly how many:
# "Rate limit reached ... Please try again in 3.0525s". That number lives in
# the response *body*, not the retry-after header, so reading only the header
# meant a 3-second problem was served the 30-second default — long enough to
# bench every model in the chain and kill the buyer's turn outright.
_RETRY_AFTER_BODY_RE = re.compile(
    r"try again in\s+(?:(?P<minutes>[\d.]+)m)?(?P<seconds>[\d.]+)s", re.IGNORECASE
)

# When the whole chain is briefly cooling down, waiting beats failing a turn
# that may already have placed real orders. Sized from what Groq actually
# asks for on this tier: observed retry-after values run to ~9.5s on a TPM
# rejection, so a budget under that throws the turn away for the sake of a
# few seconds. Still bounded — one agent turn can make several of these
# calls back to back, and the buyer is waiting on all of them.
_MAX_CHAIN_WAIT_SECONDS = 12.0

# 400 is normally a real bug in our own request (bad enum, malformed schema)
# and must surface immediately, never get hidden behind a fallback. But
# "output_parse_failed" is Groq reporting that *this specific model*
# couldn't produce valid structured tool-call output for the prompt — a
# model-capability limitation (weaker/smaller models are more prone to it on
# long multi-tool-call turns), not a bug in the request. That case should
# fall through to the next model exactly like a rate limit would.
# "tool_use_failed" is the same class of problem reported under a different
# code: the model emitted a tool call that didn't satisfy the schema (a
# category outside an enum, a missing required field). Groq returns 400, but
# the request we sent was valid — this model just couldn't comply. Leaving it
# out of this set meant one bad guess from one model aborted the whole turn
# instead of falling through to the next model.
_RETRYABLE_BAD_REQUEST_CODES = {"output_parse_failed", "tool_use_failed"}


def _is_retryable_bad_request(exc: APIStatusError) -> bool:
    body = exc.body if isinstance(exc.body, dict) else {}
    error = body.get("error") if isinstance(body.get("error"), dict) else {}
    return error.get("code") in _RETRYABLE_BAD_REQUEST_CODES


class _ModelState:
    """Sliding-window usage tracker for one model, plus a cooldown timer set
    when the API itself reports the model unavailable — so a rejected model
    isn't retried again immediately even if our local counters still think
    there's room (e.g. another process is also drawing from the same quota,
    or Groq's own window doesn't align exactly with ours)."""

    def __init__(self, limits: ModelLimits):
        self.limits = limits
        self._lock = threading.Lock()
        self._request_times_min: deque[float] = deque()
        self._request_times_day: deque[float] = deque()
        self._token_events_min: deque[tuple[float, int]] = deque()
        self._token_events_day: deque[tuple[float, int]] = deque()
        self.cooldown_until = 0.0

    def _prune(self, now: float) -> None:
        while self._request_times_min and now - self._request_times_min[0] > 60:
            self._request_times_min.popleft()
        while self._request_times_day and now - self._request_times_day[0] > 86400:
            self._request_times_day.popleft()
        while self._token_events_min and now - self._token_events_min[0][0] > 60:
            self._token_events_min.popleft()
        while self._token_events_day and now - self._token_events_day[0][0] > 86400:
            self._token_events_day.popleft()

    def available(self, estimated_tokens: int) -> bool:
        now = time.time()
        with self._lock:
            if now < self.cooldown_until:
                return False
            self._prune(now)
            if len(self._request_times_min) >= self.limits.rpm:
                return False
            if len(self._request_times_day) >= self.limits.rpd:
                return False
            if self.limits.tpm is not None:
                used = sum(t for _, t in self._token_events_min)
                if used + estimated_tokens > self.limits.tpm:
                    return False
            if self.limits.tpd is not None:
                used_day = sum(t for _, t in self._token_events_day)
                if used_day + estimated_tokens > self.limits.tpd:
                    return False
            return True

    def seconds_until_available(self, estimated_tokens: int) -> float:
        """How long until this model could accept a call of this size.

        Every constraint must be satisfied, so the answer is the longest of
        the individual waits. Returning a real number (rather than polling
        blindly) is what lets the caller tell "wait 3s, it'll work" apart
        from "this window needs another 40s" — the second case should fail
        immediately instead of burning the buyer's time spinning.
        """
        now = time.time()
        with self._lock:
            self._prune(now)
            waits = [max(0.0, self.cooldown_until - now)]

            if len(self._request_times_min) >= self.limits.rpm:
                waits.append(max(0.0, 60.0 - (now - self._request_times_min[0])))
            if self.limits.rpd is not None and len(self._request_times_day) >= self.limits.rpd:
                return float("inf")  # daily request cap: not recoverable in-turn

            if self.limits.tpm is not None:
                used = sum(t for _, t in self._token_events_min)
                deficit = used + estimated_tokens - self.limits.tpm
                if deficit > 0:
                    # Wait until enough of the oldest token events age out of
                    # the 60s window to make room for this request.
                    freed = 0
                    wait_for_tokens = float("inf")
                    for ts, tokens in self._token_events_min:  # oldest first
                        freed += tokens
                        if freed >= deficit:
                            wait_for_tokens = max(0.0, 60.0 - (now - ts))
                            break
                    waits.append(wait_for_tokens)

            if self.limits.tpd is not None:
                used_day = sum(t for _, t in self._token_events_day)
                if used_day + estimated_tokens > self.limits.tpd:
                    return float("inf")  # daily token cap

            return max(waits)

    def record_usage(self, tokens_used: int) -> None:
        now = time.time()
        with self._lock:
            self._request_times_min.append(now)
            self._request_times_day.append(now)
            if tokens_used:
                self._token_events_min.append((now, tokens_used))
                self._token_events_day.append((now, tokens_used))

    def cool_down(self, seconds: float) -> None:
        with self._lock:
            self.cooldown_until = max(self.cooldown_until, time.time() + seconds)


_states: dict[str, _ModelState] = {m.name: _ModelState(m) for m in MODEL_CHAIN}
_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        # max_retries=0: the SDK's own default retry-on-429 blocks and
        # retries the *same* model for several seconds before ever raising —
        # directly fighting this gateway's job, which is to fail fast on a
        # rate-limited model and move to the next one's separate quota
        # bucket instead of waiting out the first one's cooldown.
        _client = Groq(api_key=settings.GROQ_API_KEY, max_retries=0)
    return _client


def _estimate_tokens(messages: list[dict], tools: list[dict] | None = None) -> int:
    # Cheap ~4-chars/token heuristic — only used to proactively skip a model
    # we already know is full. The authoritative check is still the API's
    # own 429/413 response, handled reactively below.
    #
    # The tool schemas count: they are re-sent on every call and are ~900
    # tokens here (the search_catalog `category` enum lists every category in
    # the catalog). Omitting them under-estimated each request by nearly a
    # third, so this guard waved through calls that were already over the
    # model's TPM budget and collected a hard 429 instead of quietly routing
    # to the next model's bucket.
    chars = sum(len(str(m.get("content") or "")) + len(str(m.get("tool_calls") or ""))
                for m in messages)
    if tools:
        chars += len(json.dumps(tools))
    return max(500, chars // 4)


def _retry_after_seconds(exc: APIStatusError) -> float:
    header = getattr(exc.response, "headers", {}).get("retry-after") if exc.response is not None else None
    if header:
        try:
            return float(header)
        except ValueError:
            pass

    # Groq states the precise delay in the error body when it omits the
    # header — honouring it turns a 3s pause into a 3s pause instead of a
    # blanket 30s bench for the whole chain.
    body = exc.body if isinstance(exc.body, dict) else {}
    error = body.get("error") if isinstance(body.get("error"), dict) else {}
    match = _RETRY_AFTER_BODY_RE.search(str(error.get("message") or ""))
    if match:
        minutes = float(match.group("minutes") or 0.0)
        return minutes * 60.0 + float(match.group("seconds"))

    return _DEFAULT_COOLDOWN_SECONDS


def _seconds_until_any_model_free(estimated_tokens: int) -> float:
    """How long until the earliest-recovering model could take this call."""
    return min(
        (s.seconds_until_available(estimated_tokens) for s in _states.values()),
        default=0.0,
    )


def penalize_model(model_name: str, seconds: float = 25.0) -> None:
    """Bench a model that answered but produced nothing usable.

    An empty completion with no tool calls is a model-quality failure, not a
    quota one — the API returned 200, so none of the reactive 429/400 paths
    fire and the same model would be picked again on the retry. Cooling it
    down routes the next attempt to a different model's bucket, which is the
    whole point of having a chain.
    """
    state = _states.get(model_name)
    if state is not None:
        state.cool_down(seconds)


def _ordered_chain() -> list[ModelLimits]:
    # The configured GROQ_MODEL (default openai/gpt-oss-120b) goes first if
    # it's one of the known chat-capable models; the rest of the chain
    # follows in its declared priority order.
    preferred = settings.GROQ_MODEL
    if preferred in _states:
        return [m for m in MODEL_CHAIN if m.name == preferred] + [
            m for m in MODEL_CHAIN if m.name != preferred
        ]
    return MODEL_CHAIN


def chat_completion_with_fallback(
    *,
    messages: list[dict],
    tools: list[dict],
    tool_choice: str = "auto",
    temperature: float = 0.3,
    max_wait_seconds: float = _MAX_CHAIN_WAIT_SECONDS,
):
    """Tries the model chain in priority order, skipping any model already
    estimated full and falling back to the next on a 429/413/5xx/connection
    error from the one it did try. If the entire chain is momentarily cooling
    down, waits for the soonest one to recover (up to `max_wait_seconds`)
    rather than failing the caller's turn. Returns (response, model_name_used).

    Raises the last error (or RuntimeError if every model was skipped as
    locally full) if the whole chain fails — callers should catch this and
    degrade gracefully rather than let it become an unhandled 500."""
    client = _get_client()
    estimated_tokens = _estimate_tokens(messages, tools)
    last_error: Exception | None = None
    deadline = time.monotonic() + max_wait_seconds

    while True:
        for model in _ordered_chain():
            state = _states[model.name]
            if not state.available(estimated_tokens):
                continue
            try:
                response = client.chat.completions.create(
                    model=model.name,
                    messages=messages,
                    tools=tools,
                    tool_choice=tool_choice,
                    temperature=temperature,
                )
            except RateLimitError as e:
                state.cool_down(_retry_after_seconds(e))
                last_error = e
                continue
            except APIConnectionError as e:
                state.cool_down(5.0)  # likely transient network blip, short cooldown
                last_error = e
                continue
            except APIStatusError as e:
                if e.status_code in _RETRYABLE_STATUS or (e.status_code == 400 and _is_retryable_bad_request(e)):
                    state.cool_down(_retry_after_seconds(e))
                    last_error = e
                    continue
                raise  # a real bug (400/401/403/404/422) — never hide this behind a fallback

            used_tokens = getattr(getattr(response, "usage", None), "total_tokens", None) or estimated_tokens
            state.record_usage(used_tokens)
            return response, model.name

        # Every model is unavailable. These buckets refill on a seconds-long
        # sliding window, so a short wait usually rescues a turn that would
        # otherwise abort halfway through — potentially after it has already
        # placed real orders.
        wait = _seconds_until_any_model_free(estimated_tokens)
        remaining = deadline - time.monotonic()
        if remaining <= 0 or wait > remaining:
            # Fail now rather than poll: we know precisely when capacity
            # returns, and it is further out than this turn can wait.
            logger.warning(
                "model chain exhausted; soonest capacity in %.1fs, budget %.1fs — giving up",
                wait,
                max(0.0, remaining),
            )
            break
        sleep_for = min(max(wait, 0.25), remaining)
        logger.info("whole model chain unavailable; waiting %.2fs before retrying", sleep_for)
        time.sleep(sleep_for)

    if last_error is not None:
        raise last_error
    raise RuntimeError("All configured Groq models are currently rate-limited; try again shortly.")
