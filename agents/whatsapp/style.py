from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from schemas.whatsapp import StyleRequest, StyleResponse
from tools.prompt_loader import load_prompt
from whatsapp.model_client import ModelClient


def _dump(value: StyleResponse | dict[str, Any]) -> dict[str, Any]:
    if isinstance(value, BaseModel):
        return value.model_dump(by_alias=True, mode="json")
    return dict(value)


def normalize_style_output(value: StyleResponse | dict[str, Any]) -> StyleResponse:
    data = _dump(value)
    proposals = []
    for proposal in data.get("proposals", [])[:3]:
        item = dict(proposal)
        item["instruction"] = str(item.get("instruction", ""))[:160]
        proposals.append(item)
    top_edits = []
    for edit in data.get("topEdits", [])[:3]:
        item = dict(edit)
        item["description"] = str(item.get("description", ""))[:160]
        top_edits.append(item)
    data["proposals"] = proposals
    data["topEdits"] = top_edits
    return StyleResponse.model_validate(data)


async def propose_style(request: StyleRequest, client: ModelClient) -> StyleResponse:
    payload = request.model_dump(by_alias=True, mode="json")
    result = await client.complete(
        system_prompt=load_prompt("whatsapp_style.md"),
        payload=payload,
        response_model=StyleResponse,
        temperature=0.2,
    )
    return normalize_style_output(result)
