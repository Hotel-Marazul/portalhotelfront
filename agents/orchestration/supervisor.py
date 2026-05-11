from __future__ import annotations

from app.logger import log_event
from agents.agno_agent import AgnoResponseAgent
from agents.availability_agent import AvailabilityAgent
from agents.booking_agent import BookingAgent
from agents.decision_agent import DecisionAgent
from agents.policy_agent import PolicyAgent
from agents.pricing_agent import PricingAgent
from agents.receptionist_agent import ReceptionistAgent
from orchestration.flows import FlowCoordinator
from orchestration.state import ConversationStore
from schemas.messages import ChatRequest, ChatResponse
from tools.backend_api import BackendApiClient
from tools.retrieval import RetrievalPipeline


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

    async def handle_chat(self, request: ChatRequest) -> ChatResponse:
        self.store.append_turn(request.conversation_id, "user", request.user_message)
        state = self.store.get_or_create(request.conversation_id)

        reception = self.receptionist.classify(request.user_message, context=state.context)
        self.store.merge_context(request.conversation_id, reception.extracted)

        try:
            if reception.intent == "booking":
                response = await self.flows.run_booking(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                )
            elif reception.intent == "availability":
                response = await self.flows.run_availability(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                )
            elif reception.intent == "pricing":
                response = await self.flows.run_pricing(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                )
            elif reception.intent == "policy":
                response = await self.flows.run_policy(request.conversation_id, request.user_message)
            elif reception.intent == "cancel":
                response = await self.flows.run_cancel(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                )
            elif reception.intent == "update":
                response = await self.flows.run_update(
                    request.conversation_id,
                    reception.extracted,
                    reception.missing_fields,
                )
            else:
                response = self.flows.run_general(request.conversation_id)
        except Exception as exc:
            response = self.decision_agent.compose(
                conversation_id=request.conversation_id,
                intent="general",
                reply="Nao consegui concluir esta solicitacao automaticamente. Vou encaminhar para atendimento humano.",
                explanation=f"Fallback por erro nao tratado: {exc.__class__.__name__}.",
                action_type="handoff",
                action_status="blocked",
            )

        rewritten_reply = self.agno_response_agent.rewrite(request.user_message, response)
        if rewritten_reply != response.reply:
            response = response.model_copy(
                update={
                    "reply": rewritten_reply,
                    "explanation": f"{response.explanation} Texto final redigido por Agno/OpenAI.",
                }
            )

        self.store.append_turn(request.conversation_id, "assistant", response.reply)

        if response.action.resource_id:
            self.store.merge_context(request.conversation_id, {"reservation_id": response.action.resource_id})

        log_event(
            "chat_handled",
            conversation_id=request.conversation_id,
            intent=response.intent,
            action_type=response.action.type,
            action_status=response.action.status,
        )
        return response
