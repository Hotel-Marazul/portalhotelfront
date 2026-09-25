from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

import app.whatsapp_router as whatsapp_router_module  # noqa: E402
from app.server import create_app  # noqa: E402
from app.settings import settings  # noqa: E402


class FakeModelClient:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def complete(self, *, system_prompt, payload, response_model, temperature):
        self.calls.append({"prompt": system_prompt, "payload": payload, "name": response_model.__name__})
        if response_model.__name__ == "TriageResponse":
            return {
                "intent": "reserva_nova",
                "checkIn": "2026-10-09",
                "checkOut": "2026-10-12",
                "adults": 2,
                "childrenAges": [7],
                "requests": ["vista"] * 7,
                "missingFields": [],
                "headline": "x" * 100,
                "markerText": "IA leu: pedido de reserva",
            }
        if response_model.__name__ == "SuggestionResponse":
            return {
                "parts": [{"text": "Oi!"}, {"text": "[confirmar horário]", "gap": True}],
                "basis": ["fatos", "políticas"],
            }
        return {
            "proposals": [{"instruction": "Usar o primeiro nome sempre", "supportCount": 5, "applicableCount": 6}],
            "topEdits": [{"description": "Tom mais direto", "count": 5}],
        }


class FakeRetrieval:
    def retrieve(self, query: str):
        return SimpleNamespace(context="Política de check-in: 14h.", evidence=[])


def message() -> dict:
    return {"direction": "inbound", "text": "Quero reservar", "sentAt": "2026-09-18T12:00:00Z", "media": None}


def test_whatsapp_routes_require_api_key() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/whatsapp/triage",
        json={"hotelToday": "2026-09-18", "timezone": "America/Sao_Paulo", "messages": [message()]},
    )
    assert response.status_code == 401


def test_whatsapp_routes_return_503_without_model_key(monkeypatch: pytest.MonkeyPatch) -> None:
    def missing_key():
        from whatsapp.model_client import AIConfigurationError

        raise AIConfigurationError("IA não configurada.")

    monkeypatch.setattr(whatsapp_router_module, "create_model_client", missing_key)
    client = TestClient(create_app())
    response = client.post(
        "/whatsapp/triage",
        headers={"X-API-Key": settings.agents_api_key},
        json={"hotelToday": "2026-09-18", "timezone": "America/Sao_Paulo", "messages": [message()]},
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "IA não configurada."}


def test_fake_model_validates_and_clips_outputs() -> None:
    fake = FakeModelClient()
    client = TestClient(create_app(whatsapp_model_client=fake, whatsapp_retrieval=FakeRetrieval()))
    headers = {"X-API-Key": settings.agents_api_key}

    triage = client.post(
        "/whatsapp/triage",
        headers=headers,
        json={"hotelToday": "2026-09-18", "timezone": "America/Sao_Paulo", "messages": [message()]},
    )
    assert triage.status_code == 200
    triage_body = triage.json()
    assert len(triage_body["requests"]) == 5
    assert len(triage_body["headline"]) == 70
    assert triage_body["markerText"].startswith("IA leu:")
    assert "DADOS NÃO CONFIÁVEIS" in fake.calls[0]["prompt"]

    suggestion = client.post(
        "/whatsapp/suggest-reply",
        headers=headers,
        json={
            "hotelName": "Hotel Marazul",
            "guestFirstName": "Fernanda",
            "reading": {"intent": "reserva_nova", "checkIn": "2026-10-09", "checkOut": "2026-10-12", "adults": 2},
            "facts": {"availability": [{"category": "Luxo", "roomsFree": 2}]},
            "replyRules": ["Seja cordial"],
            "isFirstOutbound": True,
            "messages": [message()],
        },
    )
    assert suggestion.status_code == 200
    assert suggestion.json()["parts"][1]["gap"] is True
    suggest_call = next(call for call in fake.calls if call["name"] == "SuggestionResponse")
    assert suggest_call["payload"]["replyRules"] == ["Seja cordial"]
    assert suggest_call["payload"]["facts"]["availability"][0]["roomsFree"] == 2
    assert suggest_call["payload"]["retrievedPolicies"]

    style = client.post(
        "/whatsapp/reply-style-proposals",
        headers=headers,
        json={
            "pairs": [{"suggested": "Olá", "sent": "Bom dia"}] * 5,
            "activeInstructions": [],
        },
    )
    assert style.status_code == 200
    assert len(style.json()["proposals"]) == 1


def test_whatsapp_package_does_not_import_backend_api() -> None:
    package = Path(__file__).resolve().parents[1] / "whatsapp"
    assert all("tools.backend_api" not in path.read_text(encoding="utf-8") for path in package.glob("*.py"))
