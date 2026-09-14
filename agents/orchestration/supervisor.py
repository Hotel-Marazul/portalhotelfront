from __future__ import annotations

from app.logger import log_event
from app.settings import settings
from agents.agno_agent import AgnoResponseAgent
from agents.availability_agent import AvailabilityAgent
from agents.booking_agent import BookingAgent
from agents.decision_agent import DecisionAgent
from agents.policy_agent import PolicyAgent
from agents.pricing_agent import PricingAgent
from agents.receptionist_agent import ReceptionistAgent
from orchestration.flows import FlowCoordinator
from orchestration.state import ConversationStore, payload_hash
from schemas.messages import ChatRequest, ChatResponse
from tools.backend_api import BackendApiClient, agent_initiator_context
from tools.retrieval import RetrievalPipeline
from tools.validators import is_explicit_confirmation


class Supervisor:
    def __init__(self) -> None:
        self.store = ConversationStore()
        self.backend_api = BackendApiClient()
        self.receptionist = ReceptionistAgent()
        self.availability_agent = AvailabilityAgent(self.backend_api)
        self.booking_agent = BookingAgent(self.backend_api)
        self.policy_agent = PolicyAgent(RetrievalPipeline(), self.backend_api)
        self.pricing_agent = PricingAgent()
        self.decision_agent = DecisionAgent()
        self.agno_response_agent = AgnoResponseAgent()
        self.flows = FlowCoordinator(
            availability_agent=self.availability_agent,
            booking_agent=self.booking_agent,
            policy_agent=self.policy_agent,
            pricing_agent=self.pricing_agent,
            decision_agent=self.decision_agent,
        )

    async def handle_chat(self, request: ChatRequest, initiator_id: str | None = None) -> ChatResponse:
        with agent_initiator_context(initiator_id):
            return await self._handle_chat(request, initiator_id)

    def _metadata_context(self, request: ChatRequest) -> dict:
        metadata = request.metadata.model_dump(exclude_none=True, exclude_unset=True)
        additional_guests = metadata.pop("additional_guests", None)
        if additional_guests is not None:
            metadata["guests_payload"] = additional_guests
            metadata.setdefault("guests", len(additional_guests) + 1)
        return metadata

    async def _handle_chat(self, request: ChatRequest, initiator_id: str | None = None) -> ChatResponse:
        self.store.append_turn(request.conversation_id, "user", request.user_message, initiator_id)
        state = self.store.get_or_create(request.conversation_id, initiator_id)
        self.store.merge_context(request.conversation_id, self._metadata_context(request), initiator_id)

        confirmed = False
        proposal_id = ""
        proposal = None
        if request.confirm_proposal_id and is_explicit_confirmation(request.user_message):
            proposal_id = request.confirm_proposal_id
            proposal = self.store.get_proposal(request.conversation_id, proposal_id, initiator_id)

        if proposal:
            requested_guests = self._metadata_context(request).get("guests_payload")
            proposed_guests = proposal["payload"].get("guests_payload")
            if requested_guests is None or payload_hash({"guests_payload": requested_guests}) == payload_hash({"guests_payload": proposed_guests}):
                confirmed = True
                reception = self.receptionist.classify(request.user_message, context=proposal["payload"])
                reception.intent = proposal["intent"]
                reception.extracted = proposal["payload"]
                reception.missing_fields = []

        if not confirmed and request.confirm_proposal_id:
            response = self.decision_agent.compose(
                conversation_id=request.conversation_id,
                intent="general",
                reply="Nenhuma ação foi executada. Envie exatamente 'confirmo' enquanto a proposta ainda estiver válida.",
                explanation="Confirmações ambíguas, expiradas ou inexistentes não executam operações.",
                action_type="none",
                action_status="blocked",
            )
            return self._finish(request, response, initiator_id)

        if not confirmed:
            reception = self.receptionist.classify(request.user_message, context=state.context)
            self.store.merge_context(request.conversation_id, reception.extracted, initiator_id)
            if reception.intent in {"booking", "update", "cancel"} and not reception.missing_fields:
                proposal_id = self.store.create_proposal(
                    request.conversation_id, reception.intent, reception.extracted, initiator_id
                )

        if reception.intent in {"booking", "update", "cancel"} and not settings.agents_mutations_enabled:
            log_event("agent_mutations_disabled", intent=reception.intent)
            if proposal_id:
                self.store.consume_proposal(request.conversation_id, proposal_id, initiator_id)
            action_type = {
                "booking": "create_booking",
                "update": "update_booking",
                "cancel": "cancel_booking",
            }[reception.intent]
            response = self.decision_agent.compose(
                conversation_id=request.conversation_id,
                intent=reception.intent,
                reply="As operações de reserva pelo agente estão temporariamente desativadas. Nenhuma alteração foi feita.",
                explanation="A feature flag de mutações do agente está desativada para rollback seguro.",
                action_type=action_type,
                action_status="blocked",
            )
            return self._finish(request, response, initiator_id)

        try:
            if reception.intent == "booking":
                response = await self.flows.run_booking(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                    confirmed=confirmed,
                    proposal_id=proposal_id,
                )
            elif reception.intent == "availability":
                response = await self.flows.run_availability(
                    request.conversation_id, reception.extracted, reception.missing_fields
                )
            elif reception.intent == "pricing":
                response = await self.flows.run_pricing(
                    request.conversation_id, reception.extracted, reception.missing_fields
                )
            elif reception.intent == "policy":
                response = await self.flows.run_policy(request.conversation_id, request.user_message)
            elif reception.intent == "cancel":
                response = await self.flows.run_cancel(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                    confirmed=confirmed,
                    proposal_id=proposal_id,
                )
            elif reception.intent == "update":
                response = await self.flows.run_update(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                    confirmed=confirmed,
                    proposal_id=proposal_id,
                )
            else:
                response = self.flows.run_general(request.conversation_id)
        except Exception as exc:
            response = self.decision_agent.compose(
                conversation_id=request.conversation_id,
                intent="general",
                reply="Não consegui concluir esta solicitação automaticamente. Vou encaminhar para atendimento humano.",
                explanation=f"Fallback por erro não tratado: {exc.__class__.__name__}.",
                action_type="handoff",
                action_status="blocked",
            )

        if not confirmed and proposal_id:
            if response.action.status == "pending":
                self.store.update_proposal(request.conversation_id, proposal_id, reception.extracted, initiator_id)
            else:
                self.store.consume_proposal(request.conversation_id, proposal_id, initiator_id)
        if confirmed and proposal_id:
            self.store.consume_proposal(request.conversation_id, proposal_id, initiator_id)

        return self._finish(request, response, initiator_id)

    def _finish(self, request: ChatRequest, response: ChatResponse, initiator_id: str | None = None) -> ChatResponse:
        rewritten_reply = self.agno_response_agent.rewrite(response)
        if rewritten_reply != response.reply:
            response = response.model_copy(
                update={
                    "reply": rewritten_reply,
                    "explanation": f"{response.explanation} Texto final redigido por Agno/OpenAI.",
                }
            )

        self.store.append_turn(request.conversation_id, "assistant", response.reply, initiator_id)
        if response.action.resource_id:
            self.store.merge_context(
                request.conversation_id, {"reservation_id": response.action.resource_id}, initiator_id
            )

        log_event(
            "chat_handled",
            conversation_id=request.conversation_id,
            intent=response.intent,
            action_type=response.action.type,
            action_status=response.action.status,
        )
        return response
