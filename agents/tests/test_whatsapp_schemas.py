from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.append(str(Path(__file__).resolve().parents[1]))

from schemas.whatsapp import (  # noqa: E402
    SuggestionResponse,
    TriageResponse,
    WhatsappMessage,
)


def test_triage_output_limits_and_marker() -> None:
    response = TriageResponse.model_validate(
        {
            "intent": "preco",
            "checkIn": None,
            "checkOut": None,
            "requests": ["estacionamento"],
            "headline": "Pergunta de preço",
            "markerText": "IA leu: pergunta de preço",
        }
    )
    assert response.intent == "preco"
    assert response.check_in is None

    with pytest.raises(ValidationError):
        TriageResponse.model_validate(
            {
                "intent": "preco",
                "headline": "ok",
                "markerText": "sem prefixo",
            }
        )

    with pytest.raises(ValidationError):
        TriageResponse.model_validate(
            {
                "intent": "preco",
                "headline": "ok",
                "markerText": "IA leu: ok",
                "requests": ["x"] * 6,
            }
        )


def test_suggestion_gap_and_total_limits() -> None:
    response = SuggestionResponse.model_validate(
        {
            "parts": [{"text": "Oi!"}, {"text": "[confirmar horário]", "gap": True}],
            "basis": ["regras do hotel", "contexto da conversa"],
        }
    )
    assert len(response.parts) == 2

    with pytest.raises(ValidationError):
        SuggestionResponse.model_validate(
            {
                "parts": [{"text": "x" * 61, "gap": True}],
                "basis": ["a", "b"],
            }
        )


def test_common_message_requires_timestamp_and_caps_text() -> None:
    message = WhatsappMessage.model_validate(
        {"direction": "inbound", "text": "oi", "sentAt": "2026-09-18T12:00:00Z", "media": None}
    )
    assert message.sent_at.date() == date(2026, 9, 18)

    with pytest.raises(ValidationError):
        WhatsappMessage.model_validate(
            {"direction": "inbound", "text": "x" * 2001, "sentAt": "2026-09-18T12:00:00Z"}
        )
