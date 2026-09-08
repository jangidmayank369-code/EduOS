from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class Student360Parent(BaseModel):
    parent_id: int
    first_name: str
    last_name: str
    phone: str | None = None

    relation_type: str
    is_primary: bool
    is_emergency_contact: bool
    receives_notifications: bool


class Student360Class(BaseModel):
    id: int
    name: str


class Student360StatusHistory(BaseModel):
    id: int
    old_status: str
    new_status: str
    reason: str | None = None
    changed_at: datetime
    changed_by_user_id: int | None = None


class Student360Profile(BaseModel):
    id: int
    admission_number: str

    first_name: str
    last_name: str

    date_of_birth: date | None = None
    gender: str | None = None

    email: str | None = None
    phone: str | None = None
    address: str | None = None

    class_id: int | None = None
    school_class: Student360Class | None = None

    is_active: bool
    status: str
    status_changed_at: datetime
    status_reason: str | None = None

    created_at: datetime
    updated_at: datetime


class Student360Response(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student: Student360Profile

    parents: list[Student360Parent]

    status_history: list[Student360StatusHistory]

    attendance: list[dict]

    marks: list[dict]

    fees: list[dict]

    assignments: list[dict]

    documents: list[dict]