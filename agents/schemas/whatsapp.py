from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WhatsappBaseModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


Direction = Literal["inbound", "outbound"]
MediaType = Literal["image", "audio", "video", "document", "sticker", "location", "contact", "other"]
Intent = Literal[
    "reserva_nova",
    "preco",
    "alteracao_reserva",
    "cancelamento",
    "duvida_estadia",
    "problema_estadia",
    "agradecimento",
    "fornecedor",
    "outro",
    "desconhecida",
]
MissingField = Literal["dates", "guests"]
ShortRequest = Annotated[str, Field(max_length=40)]


class WhatsappMessage(WhatsappBaseModel):
    direction: Direction
    text: str = Field(default="", max_length=2_000)
    sent_at: datetime = Field(alias="sentAt")
    media: MediaType | None = None


class KnownContext(WhatsappBaseModel):
    is_supplier: bool = Field(default=False, alias="isSupplier")
    reservations: list[dict[str, Any]] = Field(default_factory=list, max_length=3)


class TriageRequest(WhatsappBaseModel):
    hotel_today: date = Field(alias="hotelToday")
    timezone: str = Field(min_length=1, max_length=64)
    guest_first_name: str | None = Field(default=None, alias="guestFirstName", max_length=80)
    known_context: KnownContext = Field(default_factory=KnownContext, alias="knownContext")
    messages: list[WhatsappMessage] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def message_budget(self) -> "TriageRequest":
        if sum(len(message.text) for message in self.messages) > 8_000:
            raise ValueError("messages excedem o limite de 8.000 caracteres")
        return self


class TriageResponse(WhatsappBaseModel):
    intent: Intent
    check_in: date | None = Field(default=None, alias="checkIn")
    check_out: date | None = Field(default=None, alias="checkOut")
    adults: int | None = Field(default=None, ge=1, le=50)
    children_ages: list[int] = Field(default_factory=list, alias="childrenAges", max_length=20)
    requests: list[ShortRequest] = Field(default_factory=list, max_length=5)
    missing_fields: list[MissingField] = Field(default_factory=list, alias="missingFields", max_length=2)
    headline: str = Field(max_length=70)
    marker_text: str = Field(alias="markerText", max_length=100)

    @model_validator(mode="after")
    def validate_dates_and_marker(self) -> "TriageResponse":
        if (self.check_in is None) != (self.check_out is None):
            raise ValueError("checkIn e checkOut devem ser informados juntos")
        if self.check_in is not None and self.check_out is not None and self.check_out <= self.check_in:
            raise ValueError("checkOut deve ser posterior ao checkIn")
        if not self.marker_text.startswith("IA leu:"):
            raise ValueError("markerText deve começar com 'IA leu:'")
        return self


class SuggestionReading(WhatsappBaseModel):
    intent: Intent
    check_in: date | None = Field(default=None, alias="checkIn")
    check_out: date | None = Field(default=None, alias="checkOut")
    adults: int | None = Field(default=None, ge=1, le=50)
    children_ages: list[int] = Field(default_factory=list, alias="childrenAges", max_length=20)
    requests: list[ShortRequest] = Field(default_factory=list, max_length=5)


class SuggestionRequest(WhatsappBaseModel):
    hotel_name: str = Field(alias="hotelName", min_length=1, max_length=120)
    guest_first_name: str | None = Field(default=None, alias="guestFirstName", max_length=80)
    reading: SuggestionReading
    facts: dict[str, Any] = Field(default_factory=dict)
    reply_rules: list[str] = Field(default_factory=list, alias="replyRules", max_length=20)
    is_first_outbound: bool = Field(default=False, alias="isFirstOutbound")
    messages: list[WhatsappMessage] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def message_budget(self) -> "SuggestionRequest":
        if sum(len(message.text) for message in self.messages) > 8_000:
            raise ValueError("messages excedem o limite de 8.000 caracteres")
        return self


class SuggestionPart(WhatsappBaseModel):
    text: str = Field(min_length=1, max_length=600)
    gap: bool = False

    @model_validator(mode="after")
    def validate_gap(self) -> "SuggestionPart":
        if self.gap and (len(self.text) > 60 or not (self.text.startswith("[") and self.text.endswith("]"))):
            raise ValueError("trecho gap deve ficar entre colchetes e ter até 60 caracteres")
        return self


class SuggestionResponse(WhatsappBaseModel):
    parts: list[SuggestionPart] = Field(min_length=1, max_length=20)
    basis: list[str] = Field(min_length=2, max_length=4)

    @model_validator(mode="after")
    def validate_text_budget(self) -> "SuggestionResponse":
        if len("".join(part.text for part in self.parts)) > 600:
            raise ValueError("sugestão excede 600 caracteres")
        return self


class StylePair(WhatsappBaseModel):
    suggested: str = Field(min_length=1, max_length=600)
    sent: str = Field(min_length=1, max_length=600)


class StyleRequest(WhatsappBaseModel):
    pairs: list[StylePair] = Field(min_length=5, max_length=50)
    active_instructions: list[str] = Field(default_factory=list, alias="activeInstructions", max_length=20)


class StyleProposal(WhatsappBaseModel):
    instruction: str = Field(min_length=10, max_length=160)
    support_count: int = Field(alias="supportCount", ge=0)
    applicable_count: int = Field(alias="applicableCount", ge=0)

    @model_validator(mode="after")
    def counts_are_consistent(self) -> "StyleProposal":
        if self.support_count > self.applicable_count:
            raise ValueError("supportCount não pode superar applicableCount")
        return self


class StyleTopEdit(WhatsappBaseModel):
    description: str = Field(min_length=1, max_length=160)
    count: int = Field(ge=1)


class StyleResponse(WhatsappBaseModel):
    proposals: list[StyleProposal] = Field(default_factory=list, max_length=3)
    top_edits: list[StyleTopEdit] = Field(default_factory=list, alias="topEdits", max_length=3)
