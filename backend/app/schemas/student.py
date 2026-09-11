from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.school_class import ClassSummary


class StudentCreate(BaseModel):
    email: EmailStr
    password: str
    admission_number: str
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    class_id: int | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    class_id: int | None = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admission_number: str
    first_name: str
    last_name: str
    date_of_birth: date | None
    gender: str | None
    email: EmailStr | None
    phone: str | None
    address: str | None
    class_id: int | None
    school_class: ClassSummary | None = None
    is_active: bool
    status: str
    status_changed_at: datetime
    status_reason: str | None
    created_at: datetime
    updated_at: datetime