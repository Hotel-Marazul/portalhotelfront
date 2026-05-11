from __future__ import annotations

from schemas.messages import ActionSummary, ChatResponse, EvidenceItem, IntentName


class DecisionAgent:
    def compose(
        self,
        *,
        conversation_id: str,
        intent: IntentName,
        reply: str,
        explanation: str,
        action_type: str = "none",
        action_status: str = "pending",
        resource_id: str | None = None,
        evidence: list[EvidenceItem] | None = None,
        missing_fields: list[str] | None = None,
    ) -> ChatResponse:
        return ChatResponse(
            conversation_id=conversation_id,
            reply=reply,
            intent=intent,
            action=ActionSummary(type=action_type, status=action_status, resource_id=resource_id),
            explanation=explanation,
            evidence=evidence or [],
            missing_fields=missing_fields or [],
        )

