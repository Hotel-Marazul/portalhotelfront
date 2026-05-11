from __future__ import annotations

from typing import Any

import httpx

from app.logger import log_event
from app.settings import settings


class BackendApiError(RuntimeError):
    pass


class BackendApiClient:
    def __init__(
        self,
        base_url: str | None = None,
        bearer_token: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self._base_url = (base_url or settings.backend_base_url).rstrip("/")
        self._bearer_token = bearer_token or settings.backend_bearer_token
        self._timeout_seconds = timeout_seconds or settings.backend_timeout_seconds

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._bearer_token:
            headers["Authorization"] = f"Bearer {self._bearer_token}"
        return headers

    async def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> Any:
        url = f"{self._base_url}{path}"
        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            response = await client.request(method=method, url=url, headers=self._headers(), json=json)

        if response.status_code >= 400:
            log_event(
                "backend_api_error",
                method=method,
                path=path,
                status_code=response.status_code,
                response=response.text[:400],
            )
            raise BackendApiError(f"Backend returned {response.status_code} for {method} {path}")

        if response.status_code == 204 or not response.text:
            return None

        return response.json()

    async def list_rooms(self) -> list[dict[str, Any]]:
        return await self._request("GET", "/rooms")

    async def get_availability(self, check_in: str, check_out: str, guests: int = 1) -> list[dict[str, Any]]:
        path = f"/rooms/availability?checkIn={check_in}&checkOut={check_out}&guests={guests}"
        return await self._request("GET", path)

    async def list_reservations(self) -> list[dict[str, Any]]:
        return await self._request("GET", "/Reservations")

    async def create_reservation(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/Reservations", json=payload)

    async def update_reservation(self, reservation_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("PUT", f"/Reservations/{reservation_id}", json=payload)

    async def cancel_reservation(self, reservation_id: str) -> None:
        await self._request("DELETE", f"/Reservations/{reservation_id}")

    async def get_policies(self) -> list[dict[str, Any]]:
        try:
            data = await self._request("GET", "/policies")
        except BackendApiError:
            return []
        return data if isinstance(data, list) else []

