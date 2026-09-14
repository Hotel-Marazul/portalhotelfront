from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from agents.agno_agent import AgnoResponseAgent
from agents.booking_agent import BookingAgent, BookingExecution
from app.logger import sanitize_log_value
from agents.decision_agent import DecisionAgent
from agents.policy_agent import PolicyAgent
from agents.pricing_agent import PricingAgent
from agents.receptionist_agent import ReceptionistAgent
from orchestration.flows import FlowCoordinator
from orchestration.state import ConversationOwnershipError, ConversationStore
from schemas.messages import ActionSummary, ChatResponse, EvidenceItem
from tools.backend_api import BackendApiError
from tools.retrieval import RetrievalPipeline
from tools.validators import is_explicit_confirmation


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
    def __init__(self) -> None:
        self.create_calls = 0

    async def quote(self, data):  # noqa: ANN001
        return {"pricing": {"totalPrice": 200}}

    async def create(self, data):  # noqa: ANN001
        self.create_calls += 1
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


class RecordingBookingBackend:
    def __init__(self) -> None:
        self.quote_payloads: list[dict] = []
        self.create_payloads: list[dict] = []
        self.update_payloads: list[dict] = []
        self.cancel_payloads: list[dict] = []
        self.reservation = {
            "roomId": "room-1",
            "clientId": "client-1",
            "checkInDate": "2036-04-12T17:00:00Z",
            "checkOutDate": "2036-04-15T15:00:00Z",
            "status": "Pendente",
            "version": 4,
            "totalPrice": 200,
            "guests": [{"name": "Acompanhante", "age": 30, "pricingRuleId": None}],
        }

    async def get_reservation(self, _reservation_id: str):
        return {**self.reservation, "guests": list(self.reservation["guests"])}

    async def create_reservation(self, payload):  # noqa: ANN001
        self.create_payloads.append(payload)
        return {"id": "reservation-1", **payload}

    async def quote_reservation(self, payload):  # noqa: ANN001
        self.quote_payloads.append(payload)
        return {"roomId": payload["roomId"], "clientId": payload["clientId"], "totalGuestCount": len(payload["guests"]) + 1, "pricing": {"totalPrice": 200}, "reservationVersion": 4}

    async def update_reservation(self, _reservation_id: str, payload):  # noqa: ANN001
        self.update_payloads.append(payload)
        return {"id": "reservation-1", **payload}

    async def cancel_reservation(self, _reservation_id: str, payload):  # noqa: ANN001
        self.cancel_payloads.append(payload)
        return {"id": "reservation-1", "status": "Cancelada"}


async def run_test() -> None:
    store = ConversationStore()
    proposal_id = store.create_proposal("owned-conversation", "cancel", {"reservation_id": "r1"}, "user-a")
    assert store.get_proposal("owned-conversation", proposal_id, "user-a") is not None
    try:
        store.get_proposal("owned-conversation", proposal_id, "user-b")
    except ConversationOwnershipError:
        pass
    else:
        raise AssertionError("conversation proposals must be bound to the initiating user")

    assert is_explicit_confirmation("confirmo")
    assert is_explicit_confirmation("Sim!")
    assert not is_explicit_confirmation("Sim, pode seguir")
    assert not is_explicit_confirmation("talvez")
    assert PricingAgent().estimate(
        "2026-04-12", "2026-04-14", [{"singlePrice": 100, "couplePrice": 180}], guests=1
    ).min_total == 200
    update = ReceptionistAgent().classify(
        "alterar reserva 123e4567-e89b-12d3-a456-426614174000 para 2036-04-12 a 2036-04-15 com 3 hóspedes"
    )
    assert "guests_payload" in update.missing_fields
    assert "guests_payload" not in update.extracted
    with_guest_context = ReceptionistAgent().classify(
        "alterar reserva 123e4567-e89b-12d3-a456-426614174000 para 2036-04-12 a 2036-04-15",
        context={"guests_payload": []},
    )
    assert with_guest_context.extracted["guests_payload_provided"] is True

    recording_backend = RecordingBookingBackend()
    real_booking_agent = BookingAgent(recording_backend)  # type: ignore[arg-type]
    base_update = {
        "reservation_id": "123e4567-e89b-12d3-a456-426614174000",
        "check_in": "2036-04-12",
        "check_out": "2036-04-15",
        "guests_payload_provided": False,
    }
    await real_booking_agent.quote_update(base_update)
    assert len(recording_backend.quote_payloads[-1]["guests"]) == 1
    await real_booking_agent.update(base_update)
    assert "guests" not in recording_backend.update_payloads[-1]
    await real_booking_agent.update({**base_update, "guests_payload_provided": True, "guests_payload": []})
    assert recording_backend.update_payloads[-1]["guests"] == []

    create_data = {
        "room_id": "room-1",
        "client_id": "client-1",
        "check_in": "2036-04-12",
        "check_out": "2036-04-15",
        "guests_payload": [],
        "_proposal_id": "proposal-create",
    }
    await real_booking_agent.create(create_data)
    await real_booking_agent.create(create_data)
    assert recording_backend.create_payloads[0]["idempotencyKey"] == recording_backend.create_payloads[1]["idempotencyKey"]

    await real_booking_agent.update({**base_update, "_proposal_id": "proposal-update"})
    await real_booking_agent.update({**base_update, "_proposal_id": "proposal-update"})
    assert recording_backend.update_payloads[-1]["idempotencyKey"] == recording_backend.update_payloads[-2]["idempotencyKey"]

    cancellation_snapshot = await real_booking_agent.get_cancellation_snapshot("reservation-1")
    await real_booking_agent.cancel("reservation-1", "proposal-1", expected_snapshot=cancellation_snapshot)
    assert len(recording_backend.cancel_payloads) == 1
    assert recording_backend.cancel_payloads[0]["idempotencyKey"]
    recording_backend.reservation["roomId"] = "room-2"
    try:
        await real_booking_agent.cancel("reservation-1", "proposal-1", expected_snapshot=cancellation_snapshot)
    except BackendApiError as error:
        assert error.status_code == 409
    else:
        raise AssertionError("stale cancellation proposals must not mutate")
    assert len(recording_backend.cancel_payloads) == 1

    booking_agent = FakeBookingAgent()
    flow = FlowCoordinator(
        availability_agent=FakeAvailabilityAgent(),  # type: ignore[arg-type]
        booking_agent=booking_agent,  # type: ignore[arg-type]
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

    pending = await flow.run_booking("conv-1", extracted, [], proposal_id="proposal-test")
    assert pending.action.status == "pending"
    assert pending.action.resource_id == "proposal-test"
    assert booking_agent.create_calls == 0

    response = await flow.run_booking("conv-1", extracted, [], confirmed=True, proposal_id="proposal-test")
    assert response.action.status == "completed"
    assert response.action.type == "create_booking"
    assert response.action.resource_id == "reservation-1"
    assert booking_agent.create_calls == 1

    class FailingBookingAgent(FakeBookingAgent):
        async def create(self, data):  # noqa: ANN001
            raise BackendApiError("backend unavailable", status_code=503)

    failing_flow = FlowCoordinator(
        availability_agent=FakeAvailabilityAgent(),  # type: ignore[arg-type]
        booking_agent=FailingBookingAgent(),  # type: ignore[arg-type]
        policy_agent=PolicyAgent(RetrievalPipeline(), FakeBackendApi()),  # type: ignore[arg-type]
        pricing_agent=PricingAgent(),
        decision_agent=DecisionAgent(),
    )
    failed_response = await failing_flow.run_booking(
        "conv-failure", extracted, [], confirmed=True, proposal_id="proposal-failure"
    )
    assert failed_response.action.status == "blocked"
    assert "criada" not in failed_response.reply.lower()

    safe = sanitize_log_value({
        "cpf": "123.456.789-01",
        "payment": {"amount": 99.90},
        "headers": {"Authorization": "Bearer top-secret", "X-Api-Key": "another-secret"},
        "message": "cpf 12345678901 token: top-secret",
    })
    safe_text = repr(safe)
    assert "123.456.789-01" not in safe_text
    assert "12345678901" not in safe_text
    assert "top-secret" not in safe_text
    assert "another-secret" not in safe_text

    safe_response = AgnoResponseAgent().rewrite(ChatResponse(
        conversation_id="safe-response",
        reply="CPF 123.456.789-01 e token: top-secret",
        intent="general",
        action=ActionSummary(type="none", status="blocked"),
        explanation="test",
    ))
    assert "123.456.789-01" not in safe_response
    assert "top-secret" not in safe_response


def test_booking_flow() -> None:
    asyncio.run(run_test())


if __name__ == "__main__":
    asyncio.run(run_test())
    print("test_booking_flow: ok")
