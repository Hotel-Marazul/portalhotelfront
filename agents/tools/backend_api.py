from __future__ import annotations

import contextlib
import contextvars
import hmac
from typing import Any, Iterator
from urllib.parse import urlencode
from uuid import uuid4

import httpx

from app.logger import log_event
from app.settings import settings


class BackendApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


_initiator_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "agent_initiator_id", default=None
)


@contextlib.contextmanager
def agent_initiator_context(initiator_id: str | None) -> Iterator[None]:
    token = _initiator_id.set(initiator_id)
    try:
        yield
    finally:
        _initiator_id.reset(token)


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
        initiator_id = _initiator_id.get()
        if initiator_id:
            headers["X-Agent-Initiator"] = initiator_id
            headers["X-Agent-Context-Signature"] = hmac.new(
                settings.agents_api_key.encode(), initiator_id.encode(), "sha256"
            ).hexdigest()
        return headers

    async def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> Any:
        url = f"{self._base_url}{path}"
        log_path = path.split("?", 1)[0]
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.request(method=method, url=url, headers=self._headers(), json=json)
        except httpx.HTTPError as exc:
            log_event("backend_api_unavailable", method=method, path=log_path, error=exc.__class__.__name__)
            raise BackendApiError(f"Backend unavailable for {method} {log_path}") from exc

        if response.status_code >= 400:
            log_event(
                "backend_api_error",
                method=method,
                path=log_path,
                status_code=response.status_code,
            )
            raise BackendApiError(
                f"Backend returned {response.status_code} for {method} {log_path}",
                status_code=response.status_code,
            )

        if response.status_code == 204 or not response.text:
            return None

        try:
            return response.json()
        except ValueError as exc:
            raise BackendApiError("Backend returned an invalid response") from exc

    async def get_availability(self, check_in: str, check_out: str, guests: int = 1) -> list[dict[str, Any]]:
        path = "/rooms/availability?" + urlencode({"checkIn": check_in, "checkOut": check_out, "guestCount": guests})
        data = await self._request("GET", path)
        return data if isinstance(data, list) else []

    async def get_reservation(self, reservation_id: str) -> dict[str, Any]:
        data = await self._request("GET", f"/reservations/{reservation_id}")
        return data if isinstance(data, dict) else {}

    async def quote_reservation(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = await self._request("POST", "/reservations/quote", json=payload)
        return data if isinstance(data, dict) else {}

    async def create_reservation(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = {**payload, "idempotencyKey": payload.get("idempotencyKey") or str(uuid4())}
        data = await self._request("POST", "/reservations", json=body)
        return data if isinstance(data, dict) else {}

    async def update_reservation(self, reservation_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        data = await self._request("PUT", f"/reservations/{reservation_id}", json=payload)
        return data if isinstance(data, dict) else {}

    async def cancel_reservation(self, reservation_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        data = await self._request("POST", f"/reservations/{reservation_id}/cancel", json=payload)
        return data if isinstance(data, dict) else {}

    async def get_policies(self) -> list[dict[str, Any]]:
        try:
            data = await self._request("GET", "/policies")
        except BackendApiError:
            return []
        return data if isinstance(data, list) else []
