from __future__ import annotations

from typing import Annotated

import hmac
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import ValidationError

from app.settings import settings
from schemas.whatsapp import (
    StyleRequest,
    StyleResponse,
    SuggestionRequest,
    SuggestionResponse,
    TriageRequest,
    TriageResponse,
)
from tools.retrieval import RetrievalPipeline
from whatsapp.model_client import (
    AIConfigurationError,
    AIModelError,
    ModelClient,
    create_model_client,
)
from whatsapp.style import propose_style
from whatsapp.suggest import suggest
from whatsapp.triage import classify


async def require_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    if not x_api_key or not hmac.compare_digest(x_api_key, settings.agents_api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credencial do agente inválida.")


def create_whatsapp_router(
    model_client: ModelClient | None = None,
    retrieval: RetrievalPipeline | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/whatsapp", dependencies=[Depends(require_api_key)])
    retrieval_pipeline = retrieval or RetrievalPipeline()

    def resolve_client() -> ModelClient:
        if model_client is not None:
            return model_client
        return create_model_client()

    def model_error(exc: Exception) -> HTTPException:
        if isinstance(exc, AIConfigurationError):
            return HTTPException(status_code=503, detail="IA não configurada.")
        if isinstance(exc, (AIModelError, ValidationError)):
            return HTTPException(status_code=502, detail="A IA retornou uma resposta inválida ou indisponível.")
        return HTTPException(status_code=502, detail="Falha temporária ao consultar a IA.")

    @router.post("/triage", response_model=TriageResponse, response_model_by_alias=True)
    async def triage(payload: TriageRequest) -> TriageResponse:
        try:
            return await classify(payload, resolve_client())
        except Exception as exc:
            raise model_error(exc) from exc

    @router.post("/suggest-reply", response_model=SuggestionResponse, response_model_by_alias=True)
    async def suggest_reply(payload: SuggestionRequest) -> SuggestionResponse:
        try:
            return await suggest(payload, resolve_client(), retrieval_pipeline)
        except Exception as exc:
            raise model_error(exc) from exc

    @router.post("/reply-style-proposals", response_model=StyleResponse, response_model_by_alias=True)
    async def reply_style_proposals(payload: StyleRequest) -> StyleResponse:
        try:
            return await propose_style(payload, resolve_client())
        except Exception as exc:
            raise model_error(exc) from exc

    return router
