from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.settings import settings


def create_router() -> APIRouter:
    router = APIRouter()

    async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
        if not x_api_key or not hmac.compare_digest(x_api_key, settings.agents_api_key):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credencial do agente inválida.")

    @router.get("/health")
    async def health(_: None = Depends(require_api_key)) -> dict[str, str]:
        return {"status": "ok"}

    return router
