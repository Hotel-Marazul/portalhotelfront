from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from schemas.messages import IntentName
from tools.validators import extract_dates, extract_guest_count, extract_reservation_id, normalize_text


UUID_LABEL_PATTERN = re.compile(
    r"\b(cliente|client|room|quarto|reserva|reservation)\s*(?:id)?\s*[:=]?\s*"
    r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\b"
)


@dataclass
class ReceptionOutcome:
    intent: IntentName
    confidence: float
    extracted: dict[str, Any] = field(default_factory=dict)
    missing_fields: list[str] = field(default_factory=list)


class ReceptionistAgent:
    def classify(self, message: str, context: dict[str, Any] | None = None) -> ReceptionOutcome:
        context = context or {}
        text = normalize_text(message)

        intent = self._detect_intent(text)
        extracted = self._extract_entities(message, context)
        missing = self._detect_missing(intent, extracted)

        return ReceptionOutcome(
            intent=intent,
            confidence=0.85 if intent != "unknown" else 0.4,
            extracted=extracted,
            missing_fields=missing,
        )

    def _detect_intent(self, text: str) -> IntentName:
        if any(token in text for token in ["cancelar", "cancelamento", "desistir"]):
            return "cancel"
        if any(token in text for token in ["alterar", "mudar", "atualizar"]):
            return "update"
        if any(token in text for token in ["política", "politica", "regra", "pet", "check-in", "checkin"]):
            return "policy"
        if any(token in text for token in ["preço", "preco", "valor", "tarifa"]):
            return "pricing"
        if any(token in text for token in ["disponibilidade", "disponível", "disponivel", "vaga"]):
            return "availability"
        if any(token in text for token in ["reserva", "reservar", "quero ficar"]):
            return "booking"
        if text:
            return "general"
        return "unknown"

    def _extract_entities(self, message: str, context: dict[str, Any]) -> dict[str, Any]:
        check_in, check_out = extract_dates(message)
        guests = extract_guest_count(message)
        reservation_id = extract_reservation_id(message)

        entity_map = {
            "check_in": check_in or context.get("check_in"),
            "check_out": check_out or context.get("check_out"),
            "guests": guests if guests is not None else context.get("guests", 1),
            "reservation_id": reservation_id or context.get("reservation_id"),
            "client_id": context.get("client_id"),
            "room_id": context.get("room_id"),
            "guests_payload_provided": "guests_payload" in context,
        }
        if "guests_payload" in context:
            entity_map["guests_payload"] = context["guests_payload"]

        for label, value in UUID_LABEL_PATTERN.findall(message):
            label_key = label.lower()
            if label_key in {"cliente", "client"}:
                entity_map["client_id"] = value
            elif label_key in {"room", "quarto"}:
                entity_map["room_id"] = value
            elif label_key in {"reserva", "reservation"}:
                entity_map["reservation_id"] = value

        return entity_map

    def _detect_missing(self, intent: IntentName, extracted: dict[str, Any]) -> list[str]:
        missing: list[str] = []

        if intent in {"booking", "availability", "pricing", "update"}:
            if not extracted.get("check_in"):
                missing.append("check_in")
            if not extracted.get("check_out"):
                missing.append("check_out")

        if intent == "booking":
            if not extracted.get("client_id"):
                missing.append("client_id")
            if not extracted.get("room_id"):
                missing.append("room_id")

        if intent in {"booking", "update", "availability", "pricing"}:
            guest_count = int(extracted.get("guests", 1) or 0)
            if guest_count < 1:
                missing.append("guests")
            elif intent in {"booking", "update"} and guest_count > 1 and len(extracted.get("guests_payload", [])) < guest_count - 1:
                missing.append("guests_payload")

        if intent in {"cancel", "update"} and not extracted.get("reservation_id"):
            missing.append("reservation_id")

        return missing

