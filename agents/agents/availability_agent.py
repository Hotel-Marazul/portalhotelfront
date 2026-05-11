from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from schemas.messages import EvidenceItem
from tools.backend_api import BackendApiClient


@dataclass
class AvailabilityResult:
    has_availability: bool
    available_rooms: list[dict[str, Any]]
    summary: str
    evidence: list[EvidenceItem]


class AvailabilityAgent:
    def __init__(self, backend_api: BackendApiClient) -> None:
        self.backend_api = backend_api

    async def check(self, check_in: str, check_out: str, guests: int = 1) -> AvailabilityResult:
        rooms = await self.backend_api.get_availability(check_in=check_in, check_out=check_out, guests=guests)
        has_rooms = len(rooms) > 0

        if has_rooms:
            summary = f"Encontrei {len(rooms)} quarto(s) disponível(eis) para o período."
        else:
            summary = "Não encontrei quartos disponíveis para esse período."

        evidence = [
            EvidenceItem(
                source="tool.backend_api.get_availability",
                excerpt=f"rooms_found={len(rooms)}",
            )
        ]

        return AvailabilityResult(
            has_availability=has_rooms,
            available_rooms=rooms,
            summary=summary,
            evidence=evidence,
        )
