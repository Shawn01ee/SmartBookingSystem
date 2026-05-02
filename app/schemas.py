from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, EmailStr, Field


class AdminSessionIn(BaseModel):
    token: str


class RestaurantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    contact_email: EmailStr | None = None


class RestaurantOut(BaseModel):
    id: int
    name: str
    description: str | None
    contact_email: str | None


class TableCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    capacity: int = Field(ge=1, le=20)
    combinable_group: str | None = Field(default=None, max_length=80)


class SlotCreate(BaseModel):
    day: date
    time: time
    is_open: bool = True


class SlotOut(BaseModel):
    id: int
    day: date
    time: time
    is_open: bool


class ReservationCreate(BaseModel):
    slot_id: int
    party_size: int = Field(ge=1, le=20)
    guest_name: str = Field(min_length=1, max_length=120)
    guest_email: EmailStr
    phone_number: str = Field(min_length=8, max_length=32)


class WaitlistCreate(BaseModel):
    day: date
    time_start: time
    time_end: time
    party_size: int = Field(ge=1, le=20)
    guest_name: str = Field(min_length=1, max_length=120)
    guest_email: EmailStr
    phone_number: str = Field(min_length=8, max_length=32)
    notes: str | None = Field(default=None, max_length=1000)


class EmailVerificationRequestIn(BaseModel):
    email: EmailStr


class EmailVerificationConfirmIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=16)


class OpenSlotCreate(BaseModel):
    slot_id: int
    party_size_cap: int = Field(ge=1, le=20)


class ClaimOut(BaseModel):
    token: str
    status: str
    expires_at: datetime
    restaurant_name: str
    day: date
    time: time
    party_size: int


class PaymentOut(BaseModel):
    token: str
    reservation_id: int
    amount: int
    status: str
    expires_at: datetime
    tables: list[str]
