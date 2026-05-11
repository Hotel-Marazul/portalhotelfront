from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from agents.decision_agent import DecisionAgent
from agents.policy_agent import PolicyAgent
from agents.pricing_agent import PricingAgent
from orchestration.flows import FlowCoordinator
from tools.retrieval import RetrievalPipeline


class NoAvailabilityAgent:
    async def check(self, check_in: str, check_out: str, guests: int = 1):  # noqa: ARG002
        return type(
            "AvailabilityResult",
            (),
            {
                "has_availability": False,
                "available_rooms": [],
                "summary": "none",
                "evidence": [],
            },
        )()


class ShouldNotCreateBookingAgent:
    async def create(self, data):  # noqa: ANN001, ARG002
        raise AssertionError("booking.create should not be called when there is no availability")


class FakeBackendApi:
    async def get_policies(self):
        return []


async def run_test() -> None:
    flow = FlowCoordinator(
        availability_agent=NoAvailabilityAgent(),  # type: ignore[arg-type]
        booking_agent=ShouldNotCreateBookingAgent(),  # type: ignore[arg-type]
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
    response = await flow.run_booking("conv-overbook", extracted, [])
    assert response.action.status == "blocked"
    assert response.action.type == "create_booking"


if __name__ == "__main__":
    asyncio.run(run_test())
    print("test_overbooking_guard: ok")
