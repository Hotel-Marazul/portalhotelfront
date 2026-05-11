from __future__ import annotations

from fastapi import APIRouter

from orchestration.supervisor import Supervisor
from schemas.messages import ChatRequest, ChatResponse


def create_router(supervisor: Supervisor) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @router.get("/tools")
    async def tools() -> dict[str, list[str]]:
        return {
            "tools": [
                "backend_api.list_rooms",
                "backend_api.get_availability",
                "backend_api.list_reservations",
                "backend_api.create_reservation",
                "backend_api.update_reservation",
                "backend_api.cancel_reservation",
                "retrieval.search",
            ]
        }

    @router.post("/chat", response_model=ChatResponse)
    async def chat(payload: ChatRequest) -> ChatResponse:
        return await supervisor.handle_chat(payload)

    return router

