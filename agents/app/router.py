from __future__ import annotations

import hashlib
import hmac
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.settings import settings

from orchestration.state import ConversationOwnershipError
from orchestration.supervisor import Supervisor
from schemas.messages import ChatRequest, ChatResponse


def create_router(supervisor: Supervisor) -> APIRouter:
    router = APIRouter()

    async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
        if not x_api_key or not hmac.compare_digest(x_api_key, settings.agents_api_key):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credencial do agente inválida.")

    @router.get("/health")
    async def health(_: None = Depends(require_api_key)) -> dict[str, str]:
        return {"status": "ok"}

    @router.get("/tools")
    async def tools(_: None = Depends(require_api_key)) -> dict[str, list[str]]:
        return {
            "tools": [
                "backend_api.get_availability",
                "backend_api.get_reservation",
                "backend_api.quote_reservation",
                "backend_api.create_reservation",
                "backend_api.update_reservation",
                "backend_api.cancel_reservation",
                "retrieval.search",
            ]
        }

    async def require_agent_context(
        x_agent_initiator: str | None = Header(default=None),
        x_agent_context_signature: str | None = Header(default=None),
    ) -> str:
        if not x_agent_initiator or not x_agent_context_signature:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contexto do agente ausente.")
        try:
            UUID(x_agent_initiator)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contexto do agente inválido.") from exc
        expected = hmac.new(
            settings.agents_api_key.encode(), x_agent_initiator.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(x_agent_context_signature, expected):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contexto do agente inválido.")
        return x_agent_initiator

    @router.post("/chat", response_model=ChatResponse)
    async def chat(
        payload: ChatRequest,
        _: None = Depends(require_api_key),
        initiator_id: str = Depends(require_agent_context),
    ) -> ChatResponse:
        try:
            return await supervisor.handle_chat(payload, initiator_id=initiator_id)
        except ConversationOwnershipError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A conversa pertence a outro usuário.") from exc

    return router
