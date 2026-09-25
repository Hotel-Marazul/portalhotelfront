from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from schemas.whatsapp import SuggestionRequest, SuggestionResponse
from tools.prompt_loader import load_prompt
from tools.retrieval import RetrievalPipeline
from whatsapp.model_client import ModelClient


def _dump(value: SuggestionResponse | dict[str, Any]) -> dict[str, Any]:
    if isinstance(value, BaseModel):
        return value.model_dump(by_alias=True, mode="json")
    return dict(value)


def normalize_suggestion_output(value: SuggestionResponse | dict[str, Any]) -> SuggestionResponse:
    data = _dump(value)
    clipped_parts: list[dict[str, Any]] = []
    remaining = 600
    for raw_part in data.get("parts", [])[:20]:
        gap = bool(raw_part.get("gap", False))
        text = str(raw_part.get("text", ""))
        if gap:
            text = f"[{text.strip('[]')[:58]}]"
        text = text[:remaining]
        if text:
            clipped_parts.append({"text": text, "gap": gap})
            remaining -= len(text)
        if remaining <= 0:
            break
    data["parts"] = clipped_parts
    data["basis"] = [str(item)[:120] for item in data.get("basis", [])[:4]]
    return SuggestionResponse.model_validate(data)


async def suggest(
    request: SuggestionRequest,
    client: ModelClient,
    retrieval: RetrievalPipeline,
) -> SuggestionResponse:
    payload = request.model_dump(by_alias=True, mode="json")
    query = " ".join(
        [
            request.reading.intent,
            " ".join(request.reading.requests),
            request.guest_first_name or "",
        ]
    ).strip()
    retrieved = retrieval.retrieve(query or "atendimento hotel")
    payload["retrievedPolicies"] = retrieved.context
    payload["messages"] = [
        {
            "direction": message["direction"],
            "text": message["text"],
            "sentAt": message["sentAt"],
            "media": message["media"],
        }
        for message in payload["messages"]
    ]
    result = await client.complete(
        system_prompt=load_prompt("whatsapp_suggest.md"),
        payload=payload,
        response_model=SuggestionResponse,
        temperature=0.4,
    )
    return normalize_suggestion_output(result)
