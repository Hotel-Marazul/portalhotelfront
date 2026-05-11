from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from agents.booking_agent import BookingExecution
from agents.decision_agent import DecisionAgent
from agents.policy_agent import PolicyAgent
from agents.pricing_agent import PricingAgent
from orchestration.flows import FlowCoordinator
from schemas.messages import EvidenceItem
from tools.retrieval import RetrievalPipeline


class FakeAvailabilityAgent:
    async def check(self, check_in: str, check_out: str, guests: int = 1):  # noqa: ARG002
        return type(
            "AvailabilityResult",
            (),
            {
                "has_availability": True,
                "available_rooms": [{"id": "room-1", "number": 101, "dailyPrice": 200}],
                "summary": "ok",
                "evidence": [EvidenceItem(source="test", excerpt="rooms=1")],
            },
        )()


class FakeBookingAgent:
    async def create(self, data):  # noqa: ANN001
        return BookingExecution(
            success=True,
            action="create_booking",
            resource_id="reservation-1",
            message="Reserva criada com sucesso.",
            payload=data,
        )


class FakeBackendApi:
    async def get_policies(self):
        return []


async def run_test() -> None:
    flow = FlowCoordinator(
        availability_agent=FakeAvailabilityAgent(),  # type: ignore[arg-type]
        booking_agent=FakeBookingAgent(),  # type: ignore[arg-type]
        policy_agent=PolicyAgent(RetrievalPipeline(), FakeBackendApi()),  # type: ignore[arg-type]
        pricing_agent=PricingAgent(),
        decision_agent=DecisionAgent(),
    )

    extracted = {
        "check_in": "2026-04-12",
        "check_out": "2026-04-15",
        "guests": 2,
        "room_id": "room-1",
        "client_id": "client-1",
    }

    response = await flow.run_booking("conv-1", extracted, [])
    assert response.action.status == "completed"
    assert response.action.type == "create_booking"
    assert response.action.resource_id == "reservation-1"


if __name__ == "__main__":
    asyncio.run(run_test())
    print("test_booking_flow: ok")
