from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel

from schemas.whatsapp import TriageRequest, TriageResponse
from tools.prompt_loader import load_prompt
from whatsapp.model_client import ModelClient


def _dump(value: TriageResponse | dict[str, Any]) -> dict[str, Any]:
    if isinstance(value, BaseModel):
        return value.model_dump(by_alias=True, mode="json")
    return dict(value)


def normalize_triage_output(
    value: TriageResponse | dict[str, Any],
    hotel_today: date | None = None,
) -> TriageResponse:
    data = _dump(value)
    data["requests"] = [str(item)[:40] for item in data.get("requests", [])[:5]]
    data["headline"] = str(data.get("headline", ""))[:70]
    data["markerText"] = str(data.get("markerText", ""))[:100]
    data["childrenAges"] = list(data.get("childrenAges", []))[:20]
    missing_fields = list(dict.fromkeys(data.get("missingFields", [])))

    try:
        check_in = date.fromisoformat(str(data["checkIn"])) if data.get("checkIn") else None
        check_out = date.fromisoformat(str(data["checkOut"])) if data.get("checkOut") else None
    except (KeyError, TypeError, ValueError):
        check_in = check_out = None
    if check_in is None or check_out is None or check_out <= check_in or (hotel_today and check_in < hotel_today):
        data["checkIn"] = None
        data["checkOut"] = None
        if "dates" not in missing_fields:
            missing_fields.append("dates")
    if data.get("adults") is None and "guests" not in missing_fields:
        missing_fields.append("guests")
    data["missingFields"] = missing_fields[:2]
    return TriageResponse.model_validate(data)


async def classify(request: TriageRequest, client: ModelClient) -> TriageResponse:
    payload = request.model_dump(by_alias=True, mode="json")
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
        system_prompt=load_prompt("whatsapp_triage.md"),
        payload=payload,
        response_model=TriageResponse,
        temperature=0.1,
    )
    return normalize_triage_output(result, request.hotel_today)
