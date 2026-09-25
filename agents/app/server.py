from __future__ import annotations

from fastapi import FastAPI
import uvicorn

from app.logger import log_event
from app.router import create_router
from app.settings import settings
from app.whatsapp_router import create_whatsapp_router
from orchestration.supervisor import Supervisor
from tools.retrieval import RetrievalPipeline
from whatsapp.model_client import ModelClient


def create_app(
    supervisor: Supervisor | None = None,
    whatsapp_model_client: ModelClient | None = None,
    whatsapp_retrieval: RetrievalPipeline | None = None,
) -> FastAPI:
    supervisor = supervisor or Supervisor()
    app = FastAPI(
        title="PortalHotel Agents",
        version="1.0.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.include_router(create_router(supervisor))
    app.include_router(create_whatsapp_router(whatsapp_model_client, whatsapp_retrieval))
    return app


app = create_app()


if __name__ == "__main__":
    log_event("agents_starting", port=settings.agents_port, env=settings.node_env)
    uvicorn.run("app.server:app", host="0.0.0.0", port=settings.agents_port, reload=False)

