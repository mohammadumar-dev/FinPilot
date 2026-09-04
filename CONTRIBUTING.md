# Contributing to FinPilot

Thanks for your interest. Bug reports, documentation fixes, and features are all welcome.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md). Please do **not** open a
public issue for a security vulnerability — see [SECURITY.md](./SECURITY.md).

## Before you start

For anything larger than a bug fix or a typo, open an issue first and describe what you want to
change. It's much easier to agree on an approach before the code exists than after.

Two constraints are worth knowing up front, because they shape most of this codebase:

- **Both front doors share one core.** The buyer chat agent and the MCP server must call the same
  catalog and order services. A guardrail added to one path and not the other is a bug, not a
  feature.
- **Money moves only after an explicit confirmation**, and every attempt — allowed or `blocked` —
  is written to the audit trail. Changes that weaken either property need a strong argument in the
  issue thread.

## Development setup

Follow the [Quick start](./README.md#quick-start) in the README. In short: Python 3.12+ with the
backend's `requirements.txt`, Node 20+ for the frontend, and a local PostgreSQL you can run
`alembic upgrade head` and `python -m app.seed.seed_data` against.

Never commit a real `.env`. Add new configuration to `apps/finpilot-backend/.env.example` with a
placeholder value and a comment explaining what it's for.

## Making a change

1. Branch off `develop` (not `main`): `git switch -c feat/short-description develop`.
2. Make the change. Match the surrounding style rather than introducing your own — the codebase is
   deliberately consistent about naming, comment density, and error handling.
3. Run the checks below.
4. Open a pull request against `develop`, describing what changed and why. Link the issue if there
   is one.

### Branch and commit naming

Branches are `type/short-description`; commits follow
[Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `refactor:`,
`chore:`, `style:`, `test:`, with an optional scope, e.g. `fix(campaigns): honor schedule end date`.

### Checks to run

```bash
# Frontend
cd apps/finpilot-web
npx tsc --noEmit
npm run lint
npm run build

# Backend — make sure it boots and migrations are linear
cd apps/finpilot-backend
alembic upgrade head
python -c "from app.main import app"
```

### Database changes

Schema changes need an Alembic migration (`alembic revision --autogenerate -m "..."`). Read the
generated file before committing it — autogenerate misses server defaults, enum changes, and data
backfills. Update [`docs/data-model.md`](./docs/data-model.md) in the same PR.

### Documentation

If your change affects behavior a user or an integrator can observe, update the relevant file in
[`docs/`](./docs/README.md) in the same pull request. New API endpoints and MCP tools belong in
[`docs/api-reference.md`](./docs/api-reference.md).

## Reporting bugs

Open an issue with what you expected, what happened, and the smallest set of steps that reproduces
it. Include the relevant log output. Scrub API keys, tokens, and payment identifiers before pasting
anything.
