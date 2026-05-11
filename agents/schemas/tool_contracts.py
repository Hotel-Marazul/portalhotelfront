from __future__ import annotations

from pydantic import BaseModel, Field


class RoomContract(BaseModel):
    id: str
    number: int
    type: str
    capacity: int
    daily_price: float = Field(alias="dailyPrice")
    status: str


class ReservationContract(BaseModel):
    id: str
    room_id: str = Field(alias="roomId")
    client_id: str = Field(alias="clientId")
    check_in_date: str = Field(alias="checkInDate")
    check_out_date: str = Field(alias="checkOutDate")
    status: str
    total_price: float = Field(alias="totalPrice")


class PolicyContract(BaseModel):
    id: str
    title: str
    content: str
    source: str

