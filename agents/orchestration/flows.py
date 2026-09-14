from __future__ import annotations

from agents.availability_agent import AvailabilityAgent
from agents.booking_agent import BookingAgent
from agents.decision_agent import DecisionAgent
from agents.policy_agent import PolicyAgent
from agents.pricing_agent import PricingAgent
from schemas.messages import ChatResponse, EvidenceItem, IntentName
from tools.backend_api import BackendApiError
from orchestration.state import payload_hash
from tools.validators import validate_period


FIELD_LABELS = {
    "check_in": "data de check-in (YYYY-MM-DD)",
    "check_out": "data de check-out (YYYY-MM-DD)",
    "client_id": "client_id",
    "room_id": "room_id",
    "reservation_id": "reservation_id",
    "guests_payload": "dados dos hóspedes adicionais (nome e idade)",
    "guests": "quantidade de hóspedes maior que zero",
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
            action_type="check_availability" if intent in {"availability", "pricing"} else "create_booking" if intent == "booking" else "update_booking",
            action_status="blocked",
            missing_fields=missing_fields or [],
            evidence=[EvidenceItem(source="tool.validators.validate_period", excerpt="invalid_date_range")],
        )

    def _confirmation_response(
        self,
        conversation_id: str,
        intent: IntentName,
        action_type: str,
        proposal_id: str,
        summary: str,
    ) -> ChatResponse:
        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent=intent,
            reply=f"{summary} Para executar, responda explicitamente: confirmo.",
            explanation="Nenhuma escrita foi enviada ao backend antes da confirmação humana.",
            action_type=action_type,  # type: ignore[arg-type]
            action_status="pending",
            resource_id=proposal_id,
            evidence=[EvidenceItem(source="proposal.confirmation", excerpt=f"proposal_id={proposal_id}")],
        )

    def _booking_summary(self, extracted: dict, quote: dict) -> str:
        pricing = quote.get("pricing", {}) if isinstance(quote, dict) else {}
        total = pricing.get("totalPrice")
        total_text = f"R$ {float(total):.2f}" if total is not None else "valor a confirmar pelo backend"
        room = str(extracted.get("room_id", ""))
        room = room[:8] if len(room) > 8 else room
        client = str(extracted.get("client_id", ""))
        client = client[:8] if len(client) > 8 else client
        guests = int(extracted.get("guests", 1) or 1)
        return (
            f"Resumo: cliente {client}, quarto {room}, período {extracted['check_in']} a {extracted['check_out']}, "
            f"{guests} hóspede(s), total calculado pelo backend {total_text}."
        )

    def _operation_summary(self, extracted: dict, intent: IntentName, quote: dict | None = None) -> str:
        reservation_id = str(extracted.get("reservation_id", ""))
        short_id = reservation_id[:8] if len(reservation_id) > 8 else reservation_id
        if intent == "cancel":
            snapshot = extracted.get("_reservation_snapshot", {})
            room_id = str(snapshot.get("roomId", ""))
            check_in = snapshot.get("checkInDate", "")
            check_out = snapshot.get("checkOutDate", "")
            guest_count = snapshot.get("guestCount", "?")
            total_price = snapshot.get("totalPrice")
            total_text = f", total R$ {float(total_price):.2f}" if total_price is not None else ""
            details = f", quarto {room_id[:8]}, período {check_in} a {check_out}, {guest_count} hóspede(s){total_text}" if snapshot else ""
            return f"Resumo: cancelar a reserva {short_id}{details}."
        pricing = quote.get("pricing", {}) if isinstance(quote, dict) else {}
        total = pricing.get("totalPrice")
        total_text = f", total calculado pelo backend R$ {float(total):.2f}" if total is not None else ""
        client_id = str(quote.get("clientId") or extracted.get("client_id") or "")
        room_id = str(quote.get("roomId") or extracted.get("room_id") or "")
        guest_count = quote.get("totalGuestCount") or extracted.get("guests") or 1
        return (
            f"Resumo: alterar a reserva {short_id}, cliente {client_id[:8]}, quarto {room_id[:8]}, "
            f"período {extracted.get('check_in')} a {extracted.get('check_out')}, "
            f"{guest_count} hóspede(s){total_text}."
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
        base_missing = [item for item in missing_fields if item in {"check_in", "check_out", "guests"}]
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
        estimate = self.pricing_agent.estimate(
            check_in=check_in,
            check_out=check_out,
            available_rooms=availability.available_rooms,
            guests=guests,
        )

        return self.decision_agent.compose(
            conversation_id=conversation_id,
            intent="pricing",
            reply=estimate.message,
            explanation="Estimativa baseada no menor valor diario entre quartos disponiveis.",
            action_type="check_availability",
            action_status="completed",
            evidence=availability.evidence + [EvidenceItem(source="tool.pricing.estimate", excerpt=f"nights={estimate.nights}")],
        )

    async def run_booking(self, conversation_id: str, extracted: dict, missing_fields: list[str], *, confirmed: bool = False, proposal_id: str = "") -> ChatResponse:
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

        if hasattr(self.booking_agent, "quote"):
            try:
                quote = await self.booking_agent.quote(extracted)
            except BackendApiError:
                return self.decision_agent.compose(
                    conversation_id=conversation_id,
                    intent="booking",
                    reply="Não consegui calcular o preço final agora. Nenhuma reserva foi criada.",
                    explanation="A confirmação exige preço calculado pelo backend.",
                    action_type="create_booking",
                    action_status="blocked",
                    evidence=[EvidenceItem(source="tool.backend_api.quote_reservation", excerpt="request_failed")],
                )
        else:
            quote = {}

        quote_fingerprint = payload_hash(quote)
        if not confirmed:
            extracted["_quote_fingerprint"] = quote_fingerprint
            return self._confirmation_response(
                conversation_id, "booking", "create_booking", proposal_id,
                self._booking_summary(extracted, quote),
            )
        if extracted.get("_quote_fingerprint") and extracted["_quote_fingerprint"] != quote_fingerprint:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="booking",
                reply="O preço ou as regras mudaram. Solicite um novo resumo antes de confirmar.",
                explanation="A cotação foi revalidada no backend e não coincide com a proposta confirmada.",
                action_type="create_booking",
                action_status="blocked",
                evidence=[EvidenceItem(source="tool.backend_api.quote_reservation", excerpt="quote_changed")],
            )

        try:
            executed = await self.booking_agent.create({**extracted, "_proposal_id": proposal_id})
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

    async def run_update(self, conversation_id: str, extracted: dict, missing_fields: list[str], *, confirmed: bool = False, proposal_id: str = "") -> ChatResponse:
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

        quote: dict = {}
        if hasattr(self.booking_agent, "quote_update"):
            try:
                quote = await self.booking_agent.quote_update(extracted)
            except BackendApiError:
                return self.decision_agent.compose(
                    conversation_id=conversation_id,
                    intent="update",
                    reply="Não consegui calcular o preço final agora. Nenhuma alteração foi feita.",
                    explanation="A confirmação exige preço calculado pelo backend.",
                    action_type="update_booking",
                    action_status="blocked",
                    evidence=[EvidenceItem(source="tool.backend_api.quote_reservation", excerpt="request_failed")],
                )

        quote_fingerprint = payload_hash(quote)
        if not confirmed:
            extracted["_quote_fingerprint"] = quote_fingerprint
            extracted["_expected_version"] = quote.get("reservationVersion")
            return self._confirmation_response(
                conversation_id, "update", "update_booking", proposal_id,
                self._operation_summary(extracted, "update", quote),
            )
        if extracted.get("_quote_fingerprint") and extracted["_quote_fingerprint"] != quote_fingerprint:
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="update",
                reply="O preço ou as regras mudaram. Solicite um novo resumo antes de confirmar.",
                explanation="A cotação foi revalidada no backend e não coincide com a proposta confirmada.",
                action_type="update_booking",
                action_status="blocked",
                evidence=[EvidenceItem(source="tool.backend_api.quote_reservation", excerpt="quote_changed")],
            )

        try:
            executed = await self.booking_agent.update({**extracted, "_proposal_id": proposal_id})
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

    async def run_cancel(self, conversation_id: str, extracted: dict, missing_fields: list[str], *, confirmed: bool = False, proposal_id: str = "") -> ChatResponse:
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
        if not confirmed:
            try:
                snapshot = await self.booking_agent.get_cancellation_snapshot(reservation_id)
            except BackendApiError:
                return self.decision_agent.compose(
                    conversation_id=conversation_id,
                    intent="cancel",
                    reply="Não consegui consultar a reserva agora. Nenhuma alteração foi feita.",
                    explanation="A proposta de cancelamento exige uma fotografia autoritativa do backend.",
                    action_type="cancel_booking",
                    action_status="blocked",
                    evidence=[EvidenceItem(source="tool.backend_api.get_reservation", excerpt="request_failed")],
                )
            extracted["_reservation_snapshot"] = snapshot
            return self._confirmation_response(
                conversation_id, "cancel", "cancel_booking", proposal_id,
                self._operation_summary(extracted, "cancel"),
            )
        try:
            executed = await self.booking_agent.cancel(
                reservation_id,
                proposal_id,
                expected_snapshot=extracted.get("_reservation_snapshot"),
            )
        except BackendApiError as error:
            if error.status_code == 409:
                reply = "A reserva mudou desde o resumo. Solicite um novo cancelamento antes de confirmar."
                explanation = "A proposta foi invalidada porque os dados autoritativos da reserva mudaram."
                excerpt = "proposal_stale"
            else:
                reply = "Nao consegui cancelar a reserva agora. Verifique o reservation_id."
                explanation = "Falha no endpoint de cancelamento lógico."
                excerpt = "request_failed"
            return self.decision_agent.compose(
                conversation_id=conversation_id,
                intent="cancel",
                reply=reply,
                explanation=explanation,
                action_type="cancel_booking",
                action_status="blocked",
                evidence=[EvidenceItem(source="tool.backend_api.cancel_reservation", excerpt=excerpt)],
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
