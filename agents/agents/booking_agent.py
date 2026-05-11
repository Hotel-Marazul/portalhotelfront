from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from tools.backend_api import BackendApiClient
from tools.validators import date_to_backend_iso


@dataclass
class BookingExecution:
    success: bool
    action: str
    payload: dict[str, Any] | None = None
    resource_id: str | None = None
    message: str = ""


class BookingAgent:
    def __init__(self, backend_api: BackendApiClient) -> None:
        self.backend_api = backend_api

    async def create(self, data: dict[str, Any]) -> BookingExecution:
        payload = {
            "roomId": data["room_id"],
            "clientId": data["client_id"],
            "checkInDate": date_to_backend_iso(data["check_in"]),
            "checkOutDate": date_to_backend_iso(data["check_out"]),
            "status": data.get("status", "Pendente"),
            "guests": data.get("guests_payload", []),
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
        payload = {
            "roomId": data["room_id"],
            "clientId": data["client_id"],
            "checkInDate": date_to_backend_iso(data["check_in"]),
            "checkOutDate": date_to_backend_iso(data["check_out"]),
            "status": data.get("status", "Pendente"),
            "guests": data.get("guests_payload", []),
        }
        updated = await self.backend_api.update_reservation(reservation_id, payload)
        return BookingExecution(
            success=True,
            action="update_booking",
            payload=updated,
            resource_id=updated.get("id", reservation_id),
            message="Reserva atualizada com sucesso.",
        )

    async def cancel(self, reservation_id: str) -> BookingExecution:
        await self.backend_api.cancel_reservation(reservation_id)
        return BookingExecution(
            success=True,
            action="cancel_booking",
            payload=None,
            resource_id=reservation_id,
            message="Reserva cancelada com sucesso.",
        )

