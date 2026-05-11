from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class ConversationTurn:
    role: str
    content: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class ConversationState:
    conversation_id: str
    context: dict[str, Any] = field(default_factory=dict)
    history: list[ConversationTurn] = field(default_factory=list)


class ConversationStore:
    def __init__(self) -> None:
        self._conversations: dict[str, ConversationState] = {}

    def get_or_create(self, conversation_id: str) -> ConversationState:
        if conversation_id not in self._conversations:
            self._conversations[conversation_id] = ConversationState(conversation_id=conversation_id)
        return self._conversations[conversation_id]

    def append_turn(self, conversation_id: str, role: str, content: str) -> None:
        state = self.get_or_create(conversation_id)
        state.history.append(ConversationTurn(role=role, content=content))

    def merge_context(self, conversation_id: str, values: dict[str, Any]) -> None:
        state = self.get_or_create(conversation_id)
        for key, value in values.items():
            if value is None:
                continue
            state.context[key] = value

