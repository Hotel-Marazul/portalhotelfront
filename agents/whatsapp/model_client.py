from __future__ import annotations

import json
from typing import Any, Protocol, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.settings import settings


ModelT = TypeVar("ModelT", bound=BaseModel)


class ModelClient(Protocol):
    async def complete(
        self,
        *,
        system_prompt: str,
        payload: dict[str, Any],
        response_model: type[ModelT],
        temperature: float,
    ) -> ModelT | dict[str, Any]: ...


class AIConfigurationError(RuntimeError):
    pass


class AIModelError(RuntimeError):
    pass


class OpenAIModelClient:
    def __init__(self, api_key: str | None = None, model: str | None = None, client: Any | None = None) -> None:
        key = api_key if api_key is not None else settings.openai_api_key
        if not key:
            raise AIConfigurationError("IA não configurada.")
        self.model = model or settings.whatsapp_ai_model
        self._client = client or AsyncOpenAI(api_key=key)

    async def complete(
        self,
        *,
        system_prompt: str,
        payload: dict[str, Any],
        response_model: type[ModelT],
        temperature: float,
    ) -> ModelT:
        request_kwargs: dict[str, Any] = {
            "model": self.model,
            "input": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False, default=str)},
            ],
            "text_format": response_model,
        }
        if settings.whatsapp_ai_reasoning_effort:
            request_kwargs["reasoning"] = {"effort": settings.whatsapp_ai_reasoning_effort}
        else:
            request_kwargs["temperature"] = temperature

        try:
            response = await self._client.responses.parse(**request_kwargs)
        except Exception as exc:  # provider details never cross the API boundary
            raise AIModelError("Falha temporária ao consultar a IA.") from exc

        parsed = getattr(response, "output_parsed", None)
        if isinstance(parsed, response_model):
            return parsed
        if isinstance(parsed, dict):
            return response_model.model_validate(parsed)
        raise AIModelError("A IA não retornou uma resposta estruturada.")


def create_model_client() -> OpenAIModelClient:
    return OpenAIModelClient()
