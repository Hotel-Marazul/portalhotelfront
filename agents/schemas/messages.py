from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


IntentName = Literal["booking", "availability", "pricing", "policy", "cancel", "update", "general", "unknown"]
ActionType = Literal[
    "none", "check_availability", "create_booking", "update_booking", "cancel_booking", "answer_policy", "handoff"
]
ActionStatus = Literal["pending", "completed", "blocked"]


class AdditionalGuest(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    age: int = Field(ge=0, le=120)
    pricing_rule_id: str | None = Field(default=None, min_length=1, max_length=128)


class ChatMetadata(BaseModel):
    customer_name: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    additional_guests: list[AdditionalGuest] = Field(default_factory=list, max_length=100)


class ChatRequest(BaseModel):
    conversation_id: str = Field(min_length=3)
    user_message: str = Field(min_length=1, max_length=2000)
    channel: Literal["web", "whatsapp", "internal"] = "web"
    locale: str = "pt-BR"
    metadata: ChatMetadata = Field(default_factory=ChatMetadata)
    confirm_proposal_id: str | None = Field(default=None, min_length=16, max_length=128)


class EvidenceItem(BaseModel):
    source: str
    excerpt: str | None = None


class ActionSummary(BaseModel):
    type: ActionType = "none"
    status: ActionStatus = "pending"
    resource_id: str | None = None


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    intent: IntentName
    action: ActionSummary
    explanation: str
    evidence: list[EvidenceItem] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
