from __future__ import annotations

from agents.availability_agent import AvailabilityAgent
from agents.booking_agent import BookingAgent
from agents.decision_agent import DecisionAgent
from agents.policy_agent import PolicyAgent
from agents.pricing_agent import PricingAgent
from schemas.messages import ChatResponse, EvidenceItem, IntentName
from tools.backend_api import BackendApiError
from tools.validators import validate_period


FIELD_LABELS = {
    "check_in": "data de check-in (YYYY-MM-DD)",
    "check_out": "data de check-out (YYYY-MM-DD)",
    "client_id": "client_id",
    "room_id": "room_id",
    "reservation_id": "reservation_id",
}


class FlowCoordinator:
    def __init__(
        self,
        *,
        availability_agent: AvailabilityAgent,
        booking_agent: BookingAgent,
        policy_agent: PolicyAgent,
        pricing_agent: PricingAgent,
        decision_agent: DecisionAgent,
    ) -> None:
        self.availability_agent = availability_agent
        self.booking_agent = booking_agent
        self.policy_agent = policy_agent
        self.pricing_agent = pricing_agent
        self.decision_agent = decision_agent

    def _missing_reply(self, missing_fields: list[str]) -> str:
        labels = [FIELD_LABELS.get(item, item) for item in missing_fields]
        return "Para continuar, preciso destes dados: " + ", ".join(labels) + "."

    def _invalid_period_response(
        self, conversation_id: str, intent: IntentName, missing_fields: list[str] | None = None
    ) -> ChatResponse:
        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent=intent,
            reply="O periodo informado e invalido. A data de check-out deve ser posterior ao check-in.",
            explanation="Validacao de datas falhou antes de chamar o backend.",
            action_type="check_availability",
            action_status="blocked",
            missing_fields=missing_fields or [],
            evidence=[EvidenceItem(source="tool.validators.validate_period", excerpt="invalid_date_range")],
        )

    async def run_availability(self, conversation_id: str, extracted: dict, missing_fields: list[str]) -> ChatResponse:
        if missing_fields:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="availability",
                reply=self._missing_reply(missing_fields),
                explanation="Nao e possivel consultar disponibilidade sem as datas.",
                action_type="check_availability",
                action_status="blocked",
                missing_fields=missing_fields,
                evidence=[EvidenceItem(source="tool.receptionist.extract", excerpt="missing_required_fields")],
            )

        check_in = str(extracted["check_in"])
        check_out = str(extracted["check_out"])
        guests = int(extracted.get("guests", 1))
        if not validate_period(check_in, check_out):
            return self._invalid_period_response(conversation_id, "availability")

        availability = await self.availability_agent.check(check_in=check_in, check_out=check_out, guests=guests)
        room_numbers = [str(room.get("number")) for room in availability.available_rooms[:5]]
        details = f" Quartos sugeridos: {', '.join(room_numbers)}." if room_numbers else ""

        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="availability",
            reply=f"{availability.summary}{details}",
            explanation="Consulta realizada na tool de disponibilidade do backend.",
            action_type="check_availability",
            action_status="completed",
            evidence=availability.evidence,
        )

    async def run_pricing(self, conversation_id: str, extracted: dict, missing_fields: list[str]) -> ChatResponse:
        base_missing = [item for item in missing_fields if item in {"check_in", "check_out"}]
        if base_missing:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="pricing",
                reply=self._missing_reply(base_missing),
                explanation="Nao e possivel estimar precos sem periodo.",
                action_type="check_availability",
                action_status="blocked",
                missing_fields=base_missing,
                evidence=[EvidenceItem(source="tool.receptionist.extract", excerpt="missing_required_fields")],
            )

        check_in = str(extracted["check_in"])
        check_out = str(extracted["check_out"])
        guests = int(extracted.get("guests", 1))
        if not validate_period(check_in, check_out):
            return self._invalid_period_response(conversation_id, "pricing")

        availability = await self.availability_agent.check(check_in=check_in, check_out=check_out, guests=guests)
        estimate = self.pricing_agent.estimate(check_in=check_in, check_out=check_out, available_rooms=availability.available_rooms)

        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="pricing",
            reply=estimate.message,
            explanation="Estimativa baseada no menor valor diario entre quartos disponiveis.",
            action_type="check_availability",
            action_status="completed",
            evidence=availability.evidence + [EvidenceItem(source="tool.pricing.estimate", excerpt=f"nights={estimate.nights}")],
        )

    async def run_booking(self, conversation_id: str, extracted: dict, missing_fields: list[str]) -> ChatResponse:
        if missing_fields:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="booking",
                reply=self._missing_reply(missing_fields),
                explanation="Criacao de reserva depende de room_id, client_id e periodo.",
                action_type="create_booking",
                action_status="blocked",
                missing_fields=missing_fields,
                evidence=[EvidenceItem(source="tool.receptionist.extract", excerpt="missing_required_fields")],
            )

        check_in = str(extracted["check_in"])
        check_out = str(extracted["check_out"])
        if not validate_period(check_in, check_out):
            return self._invalid_period_response(conversation_id, "booking")

        availability = await self.availability_agent.check(
            check_in=check_in,
            check_out=check_out,
            guests=int(extracted.get("guests", 1)),
        )
        if not availability.has_availability:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="booking",
                reply="Nao ha quartos disponiveis para esse periodo. Posso sugerir datas alternativas.",
                explanation="Prevencao de overbooking: criacao bloqueada por ausencia de disponibilidade.",
                action_type="create_booking",
                action_status="blocked",
                evidence=availability.evidence,
            )

        requested_room_id = str(extracted["room_id"])
        if requested_room_id not in {str(room.get("id")) for room in availability.available_rooms}:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="booking",
                reply="O quarto informado nao esta disponivel nesse periodo. Envie outro room_id.",
                explanation="Validacao de disponibilidade por quarto antes da criacao.",
                action_type="create_booking",
                action_status="blocked",
                evidence=availability.evidence,
            )

        try:
            executed = await self.booking_agent.create(extracted)
        except BackendApiError:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="booking",
                reply="Nao consegui criar a reserva agora. Tente novamente em instantes.",
                explanation="Falha ao chamar endpoint de criacao no backend.",
                action_type="create_booking",
                action_status="blocked",
                evidence=[EvidenceItem(source="tool.backend_api.create_reservation", excerpt="request_failed")],
            )

        evidence = [EvidenceItem(source="tool.backend_api.create_reservation", excerpt=f"id={executed.resource_id}")]
        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="booking",
            reply=f"{executed.message} ID da reserva: {executed.resource_id}",
            explanation="Reserva criada com sucesso no backend via API interna.",
            action_type="create_booking",
            action_status="completed",
            resource_id=executed.resource_id,
            evidence=evidence,
        )

    async def run_update(self, conversation_id: str, extracted: dict, missing_fields: list[str]) -> ChatResponse:
        if missing_fields:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="update",
                reply=self._missing_reply(missing_fields),
                explanation="Atualizacao exige reservation_id, room_id, client_id e periodo.",
                action_type="update_booking",
                action_status="blocked",
                missing_fields=missing_fields,
                evidence=[EvidenceItem(source="tool.receptionist.extract", excerpt="missing_required_fields")],
            )

        check_in = str(extracted["check_in"])
        check_out = str(extracted["check_out"])
        if not validate_period(check_in, check_out):
            return self._invalid_period_response(conversation_id, "update")

        try:
            executed = await self.booking_agent.update(extracted)
        except BackendApiError:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="update",
                reply="Nao consegui atualizar a reserva. Verifique os dados e tente novamente.",
                explanation="Falha no endpoint de atualizacao.",
                action_type="update_booking",
                action_status="blocked",
                evidence=[EvidenceItem(source="tool.backend_api.update_reservation", excerpt="request_failed")],
            )

        evidence = [EvidenceItem(source="tool.backend_api.update_reservation", excerpt=f"id={executed.resource_id}")]
        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="update",
            reply=f"{executed.message} ID da reserva: {executed.resource_id}",
            explanation="Atualizacao concluida via API do backend.",
            action_type="update_booking",
            action_status="completed",
            resource_id=executed.resource_id,
            evidence=evidence,
        )

    async def run_cancel(self, conversation_id: str, extracted: dict, missing_fields: list[str]) -> ChatResponse:
        if missing_fields:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="cancel",
                reply=self._missing_reply(missing_fields),
                explanation="Cancelamento exige reservation_id.",
                action_type="cancel_booking",
                action_status="blocked",
                missing_fields=missing_fields,
                evidence=[EvidenceItem(source="tool.receptionist.extract", excerpt="missing_required_fields")],
            )

        reservation_id = str(extracted["reservation_id"])
        try:
            executed = await self.booking_agent.cancel(reservation_id)
        except BackendApiError:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="cancel",
                reply="Nao consegui cancelar a reserva agora. Verifique o reservation_id.",
                explanation="Falha no endpoint de cancelamento/exclusao.",
                action_type="cancel_booking",
                action_status="blocked",
                evidence=[EvidenceItem(source="tool.backend_api.cancel_reservation", excerpt="request_failed")],
            )

        evidence = [EvidenceItem(source="tool.backend_api.cancel_reservation", excerpt=f"id={executed.resource_id}")]
        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="cancel",
            reply=f"{executed.message} ID da reserva: {reservation_id}",
            explanation="Cancelamento executado via API interna.",
            action_type="cancel_booking",
            action_status="completed",
            resource_id=reservation_id,
            evidence=evidence,
        )

    async def run_policy(self, conversation_id: str, user_message: str) -> ChatResponse:
        policy = await self.policy_agent.answer(user_message)
        evidence = policy.evidence or [EvidenceItem(source="tool.policy.lookup", excerpt="no_policy_source_found")]
        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="policy",
            reply=policy.answer,
            explanation="Consulta em base RAG interna e fallback de politicas do backend.",
            action_type="answer_policy",
            action_status="completed",
            evidence=evidence,
        )

    def run_general(self, conversation_id: str) -> ChatResponse:
        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="general",
            reply=(
                "Posso ajudar com reserva, disponibilidade, preco, alteracao, cancelamento e politicas. "
                "Se quiser, ja me passe check-in e check-out no formato YYYY-MM-DD."
            ),
            explanation="Mensagem generica da recepcionista para direcionar a conversa.",
            action_type="none",
            action_status="completed",
            evidence=[EvidenceItem(source="tool.none", excerpt="guidance_only")],
        )
