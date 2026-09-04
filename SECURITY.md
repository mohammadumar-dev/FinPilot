# Security policy

FinPilot handles authentication, scoped agent API keys, and payment flows, so security reports are
taken seriously.

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for a security vulnerability.**

Report it privately through
[GitHub Security Advisories](https://github.com/mohammadumar-dev/FinPilot/security/advisories/new),
which lets us discuss and fix the issue before any details are public.

Please include:

- The type of issue (authentication bypass, spend-cap evasion, injection, key leakage, …).
- The affected component — backend, MCP server, or frontend — and file paths if you have them.
- Steps to reproduce, ideally a minimal proof of concept.
- What an attacker gets out of it.

You can expect an acknowledgement within a few days and an update on the fix as it progresses. If
you'd like credit in the advisory, say so and how you'd like to be named.

## Scope

In scope: anything that lets a caller move money without an explicit confirmation, exceed a spend
cap or rate limit, read or act on another tenant's data, escalate a buyer session into merchant
access, forge a payment webhook, or extract secrets.

Out of scope: findings that depend on a deliberately misconfigured deployment — a missing
`RAZORPAY_WEBHOOK_SECRET`, a weak `JWT_SECRET_KEY`, an over-permissive `CORS_ORIGINS`, or the
committed demo seed credentials. These are documented behaviors of the local development setup, not
vulnerabilities.

## Supported versions

FinPilot is developed on `develop` and released from `main`. Fixes land on the latest `main`; there
are no long-term support branches.

## Operator responsibilities

FinPilot ships configured for Razorpay **test mode** and seeds demo accounts with a shared, publicly
known password. Before exposing a deployment to real users or live payment credentials:

- Remove or change every seeded demo account.
- Set a strong, unique `JWT_SECRET_KEY` and a real `RAZORPAY_WEBHOOK_SECRET`.
- Restrict `CORS_ORIGINS` to your own frontend origin.
- Serve everything over HTTPS.

See [`docs/security.md`](./docs/security.md) for the guardrails the application enforces on its own.
