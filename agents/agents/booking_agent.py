from __future__ import annotations

import json
from dataclasses import dataclass
from hashlib import sha256
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from tools.backend_api import BackendApiClient, BackendApiError
from tools.validators import date_to_backend_iso


@dataclass
class BookingExecution:
    success: bool
    action: str
    payload: dict[str, Any] | None = None
    resource_id: str | None = None
    message: str = ""


def guest_payload(data: dict[str, Any]) -> list[dict[str, Any]]:
    guests = data.get("guests_payload", [])
    normalized: list[dict[str, Any]] = []
    for guest in guests:
        if not isinstance(guest, dict):
            continue
        normalized.append({
            "name": guest.get("name", ""),
            "age": guest.get("age", 0),
            "pricingRuleId": guest.get("pricingRuleId", guest.get("pricing_rule_id")),
        })
    return normalized


def guests_were_provided(data: dict[str, Any]) -> bool:
    if "guests_payload_provided" in data:
        return bool(data["guests_payload_provided"])
    return "guests_payload" in data


def cancellation_snapshot(reservation: dict[str, Any]) -> dict[str, Any]:
    guests = reservation.get("guests", []) if isinstance(reservation.get("guests", []), list) else []
    guest_values = [
        {
            "name": guest.get("name", ""),
            "age": guest.get("age", 0),
            "pricingRuleId": guest.get("pricingRuleId"),
        }
        for guest in guests
        if isinstance(guest, dict)
    ]
    guest_fingerprint = sha256(
        json.dumps(guest_values, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()
    return {
        "roomId": reservation.get("roomId"),
        "clientId": reservation.get("clientId"),
        "checkInDate": reservation.get("checkInDate"),
        "checkOutDate": reservation.get("checkOutDate"),
        "status": reservation.get("status"),
        "version": reservation.get("version"),
        "totalPrice": reservation.get("totalPrice"),
        "guestCount": len(guest_values) + 1,
        "guestFingerprint": guest_fingerprint,
    }


class BookingAgent:
    def __init__(self, backend_api: BackendApiClient) -> None:
        self.backend_api = backend_api

    async def quote(self, data: dict[str, Any]) -> dict[str, Any]:
        return await self.backend_api.quote_reservation({
            "roomId": data["room_id"],
            "clientId": data["client_id"],
            "checkInDate": date_to_backend_iso(data["check_in"]),
            "checkOutDate": date_to_backend_iso(data["check_out"]),
            "guests": guest_payload(data),
            **({"dailyRateOverride": data["daily_rate_override"]} if data.get("daily_rate_override") is not None else {}),
            **({"discountAmount": data["discount_amount"]} if data.get("discount_amount") is not None else {}),
            **({"priceOverrideReason": data["price_override_reason"]} if data.get("price_override_reason") else {}),
        })

    async def quote_update(self, data: dict[str, Any]) -> dict[str, Any]:
        existing = await self.backend_api.get_reservation(data["reservation_id"])
        existing_guests = existing.get("guests", []) if isinstance(existing, dict) else []
        guests = guest_payload(data) if guests_were_provided(data) else [
            {
                "name": guest.get("name", ""),
                "age": guest.get("age", 0),
                "pricingRuleId": guest.get("pricingRuleId"),
            }
            for guest in existing_guests
            if isinstance(guest, dict)
        ]
        quote = await self.backend_api.quote_reservation({
            "reservationId": data["reservation_id"],
            "roomId": data.get("room_id") or existing["roomId"],
            "clientId": data.get("client_id") or existing["clientId"],
            "checkInDate": date_to_backend_iso(data["check_in"]),
            "checkOutDate": date_to_backend_iso(data["check_out"]),
            "guests": guests,
        })
        return {**quote, "reservationVersion": existing.get("version")}

    async def create(self, data: dict[str, Any]) -> BookingExecution:
        proposal_id = str(data.get("_proposal_id", ""))
        idempotency_key = data.get("idempotency_key")
        if not idempotency_key and proposal_id:
            idempotency_key = str(uuid5(NAMESPACE_URL, f"portalhotel:booking:{proposal_id}"))
        payload = {
            "roomId": data["room_id"],
            "clientId": data["client_id"],
            "checkInDate": date_to_backend_iso(data["check_in"]),
            "checkOutDate": date_to_backend_iso(data["check_out"]),
            "status": data.get("status", "Pendente"),
            "guests": guest_payload(data),
            **({"idempotencyKey": idempotency_key} if idempotency_key else {}),
        }
        created = await self.backend_api.create_reservation(payload)
        return BookingExecution(
            success=True,
            action="create_booking",
            payload=created,
            resource_id=created.get("id"),
            message="Reserva criada com sucesso.",
        )

    async def update(self, data: dict[str, Any]) -> BookingExecution:
        reservation_id = data["reservation_id"]
        existing = await self.backend_api.get_reservation(reservation_id)
        proposal_id = str(data.get("_proposal_id", ""))
        idempotency_key = data.get("idempotency_key") or (
            str(uuid5(NAMESPACE_URL, f"portalhotel:update:{proposal_id}")) if proposal_id else None
        )
        guests_provided = guests_were_provided(data)
        payload = {
            "roomId": data.get("room_id") or existing["roomId"],
            "clientId": data.get("client_id") or existing["clientId"],
            "checkInDate": date_to_backend_iso(data["check_in"]),
            "checkOutDate": date_to_backend_iso(data["check_out"]),
            "version": data.get("_expected_version", existing["version"]),
            **({"guests": guest_payload(data)} if guests_provided else {}),
            **({"idempotencyKey": idempotency_key} if idempotency_key else {}),
        }
        updated = await self.backend_api.update_reservation(reservation_id, payload)
        return BookingExecution(
            success=True,
            action="update_booking",
            payload=updated,
            resource_id=updated.get("id", reservation_id),
            message="Reserva atualizada com sucesso.",
        )

    async def get_cancellation_snapshot(self, reservation_id: str) -> dict[str, Any]:
        existing = await self.backend_api.get_reservation(reservation_id)
        if not existing:
            raise BackendApiError("Reserva não encontrada.", status_code=404)
        return cancellation_snapshot(existing)

    async def cancel(
        self,
        reservation_id: str,
        proposal_id: str = "",
        expected_snapshot: dict[str, Any] | None = None,
    ) -> BookingExecution:
        existing = await self.backend_api.get_reservation(reservation_id)
        if not existing:
            raise BackendApiError("Reserva não encontrada.", status_code=404)
        if expected_snapshot and cancellation_snapshot(existing) != expected_snapshot:
            raise BackendApiError("A reserva mudou desde a apresentação da proposta.", status_code=409)
        idempotency_key = str(uuid5(NAMESPACE_URL, f"portalhotel:cancel:{proposal_id}")) if proposal_id else None
        cancelled = await self.backend_api.cancel_reservation(reservation_id, {
            "version": existing["version"],
            "reason": "Cancelamento confirmado pelo atendimento assistido.",
            **({"idempotencyKey": idempotency_key} if idempotency_key else {}),
        })
        return BookingExecution(
            success=True,
            action="cancel_booking",
            payload=cancelled,
            resource_id=reservation_id,
            message="Reserva cancelada com sucesso.",
        )
