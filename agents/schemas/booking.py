from __future__ import annotations

from pydantic import BaseModel, Field


class ReservationGuestInput(BaseModel):
    name: str = Field(min_length=2)
    age: int = Field(ge=0, le=120)
    pricing_rule_id: str | None = None


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

