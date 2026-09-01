"""Standalone entrypoint for the Agent Checkout MCP Server — a separate
process/front-door from the main FastAPI app, per the plan's architecture
(section 3): both talk to the same Merchant Checkout Core services, but this
one is reachable by any external AI agent, not just the buyer-chat UI.

Run with:
    .venv\\Scripts\\python.exe -m app.mcp_server.run
"""

import os

import uvicorn

from app.core.config import settings
from app.mcp_server.app import build_app


def main() -> None:
    # Render (and most PaaS hosts) assign the port to bind at deploy time via
    # $PORT — MCP_SERVER_PORT remains the local-dev default when it's unset.
    port = int(os.environ.get("PORT", settings.MCP_SERVER_PORT))
    uvicorn.run(build_app(), host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
