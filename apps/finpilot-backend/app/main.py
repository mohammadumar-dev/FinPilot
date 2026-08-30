import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import agent_clients, audit, auth, cart, catalog, chat, conversations, orders, webhooks
from app.core.config import settings

# Uvicorn only configures its own "uvicorn.*" loggers by default — app-level
# loggers (e.g. agent_service's model-fallback logging) have no handler and
# their INFO records are silently dropped without this.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="FinPilot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(orders.router)
app.include_router(cart.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(audit.router)
app.include_router(agent_clients.router)
app.include_router(webhooks.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
