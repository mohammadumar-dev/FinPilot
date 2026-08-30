"""ASGI wiring: the FastMCP streamable-HTTP app, wrapped in a pure-ASGI
middleware (not Starlette's BaseHTTPMiddleware, which spawns the downstream
app in a separate task and makes contextvar propagation less predictable)
that resolves the scoped API key once per request and exposes it to the
tool functions via the `current_agent` contextvar."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.mcp_server.auth import current_agent, resolve_agent_client
from app.mcp_server.server import mcp


class ApiKeyAuthMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        auth_header = headers.get(b"authorization", b"").decode("utf-8", errors="ignore")

        if not auth_header.startswith("Bearer "):
            response = JSONResponse(
                {"error": "unauthorized", "message": "Missing Authorization: Bearer <api_key> header"},
                status_code=401,
            )
            await response(scope, receive, send)
            return

        api_key = auth_header[len("Bearer ") :].strip()
        agent = resolve_agent_client(api_key)
        if agent is None:
            response = JSONResponse(
                {"error": "unauthorized", "message": "Invalid or revoked API key"}, status_code=401
            )
            await response(scope, receive, send)
            return

        token = current_agent.set(agent)
        try:
            await self.app(scope, receive, send)
        finally:
            current_agent.reset(token)


def build_app() -> ASGIApp:
    app = mcp.streamable_http_app()
    return ApiKeyAuthMiddleware(app)
