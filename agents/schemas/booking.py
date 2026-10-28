from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ReservationGuestInput(BaseModel):
    name: str = Field(default="", max_length=200)
    age: int = Field(ge=0, le=120)
    pricing_rule_id: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if value and len(value) < 2:
            raise ValueError("Informe pelo menos dois caracteres ou deixe para o check-in.")
        return value


class AvailabilityInput(BaseModel):
    check_in: str
    check_out: str
    guests: int = Field(default=1, ge=1, le=100)


class CreateBookingInput(BaseModel):
    room_id: str
    client_id: str
    check_in_date: str
    check_out_date: str
    status: str = "Pendente"
    guests: list[ReservationGuestInput] = Field(default_factory=list)


class UpdateBookingInput(CreateBookingInput):
    reservation_id: str


class CancelBookingInput(BaseModel):
    reservation_id: str

