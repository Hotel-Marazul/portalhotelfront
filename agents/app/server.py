from __future__ import annotations

from fastapi import FastAPI
import uvicorn

from app.logger import log_event
from app.router import create_router
from app.settings import settings
from orchestration.supervisor import Supervisor


def create_app() -> FastAPI:
    supervisor = Supervisor()
    app = FastAPI(title="PortalHotel Agents", version="1.0.0")
    app.include_router(create_router(supervisor))
    return app


app = create_app()


if __name__ == "__main__":
    log_event("agents_starting", port=settings.agents_port, env=settings.node_env)
    uvicorn.run("app.server:app", host="0.0.0.0", port=settings.agents_port, reload=False)

