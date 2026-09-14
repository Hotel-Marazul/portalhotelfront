from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
from secrets import token_urlsafe
from typing import Any, Iterator


def payload_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    return sha256(encoded).hexdigest()


@dataclass
class ConversationTurn:
    role: str
    content: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ConversationOwnershipError(PermissionError):
    """Raised when a conversation is accessed by another initiating user."""


@dataclass
class ConversationState:
    conversation_id: str
    initiator_id: str | None = None
    context: dict[str, Any] = field(default_factory=dict)
    history: list[ConversationTurn] = field(default_factory=list)
    proposals: dict[str, dict[str, Any]] = field(default_factory=dict)


class ConversationStore:
    def __init__(self) -> None:
        self._conversations: dict[str, ConversationState] = {}

    def get_or_create(self, conversation_id: str, initiator_id: str | None = None) -> ConversationState:
        state = self._conversations.get(conversation_id)
        if state is None:
            state = ConversationState(conversation_id=conversation_id, initiator_id=initiator_id)
            self._conversations[conversation_id] = state
        elif state.initiator_id != initiator_id and state.initiator_id is not None:
            raise ConversationOwnershipError("A conversa pertence a outro usuário iniciador.")
        elif state.initiator_id is None and initiator_id is not None:
            state.initiator_id = initiator_id
        return state

    def append_turn(self, conversation_id: str, role: str, content: str, initiator_id: str | None = None) -> None:
        state = self.get_or_create(conversation_id, initiator_id)
        state.history.append(ConversationTurn(role=role, content=content))

    def merge_context(self, conversation_id: str, values: dict[str, Any], initiator_id: str | None = None) -> None:
        state = self.get_or_create(conversation_id, initiator_id)
        for key, value in values.items():
            if value is not None:
                state.context[key] = value

    def create_proposal(
        self, conversation_id: str, intent: str, payload: dict[str, Any], initiator_id: str | None = None
    ) -> str:
        state = self.get_or_create(conversation_id, initiator_id)
        proposal_id = token_urlsafe(24)
        stored_payload = copy.deepcopy(payload)
        state.proposals[proposal_id] = {
            "intent": intent,
            "payload": stored_payload,
            "hash": payload_hash(stored_payload),
            "expires_at": datetime.now(timezone.utc).timestamp() + 600,
        }
        return proposal_id

    def get_proposal(
        self, conversation_id: str, proposal_id: str, initiator_id: str | None = None
    ) -> dict[str, Any] | None:
        state = self.get_or_create(conversation_id, initiator_id)
        proposal = state.proposals.get(proposal_id)
        if not proposal or proposal["expires_at"] < datetime.now(timezone.utc).timestamp():
            state.proposals.pop(proposal_id, None)
            return None
        if proposal["hash"] != payload_hash(proposal["payload"]):
            state.proposals.pop(proposal_id, None)
            return None
        return copy.deepcopy(proposal)

    def update_proposal(
        self, conversation_id: str, proposal_id: str, payload: dict[str, Any], initiator_id: str | None = None
    ) -> None:
        state = self.get_or_create(conversation_id, initiator_id)
        proposal = state.proposals.get(proposal_id)
        if not proposal:
            return
        stored_payload = copy.deepcopy(payload)
        proposal["payload"] = stored_payload
        proposal["hash"] = payload_hash(stored_payload)

    def consume_proposal(
        self, conversation_id: str, proposal_id: str, initiator_id: str | None = None
    ) -> dict[str, Any] | None:
        proposal = self.get_proposal(conversation_id, proposal_id, initiator_id)
        if proposal is not None:
            self.get_or_create(conversation_id, initiator_id).proposals.pop(proposal_id, None)
        return proposal
