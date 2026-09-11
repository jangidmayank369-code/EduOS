from datetime import datetime

from pydantic import BaseModel, EmailStr


class TeacherCreate(BaseModel):
    # Login account
    email: EmailStr
    password: str

    # Teacher profile
    employee_number: str
    first_name: str
    last_name: str
    phone: str | None = None


class TeacherResponse(BaseModel):
    id: int
    user_id: int
    employee_number: str
    first_name: str
    last_name: str
    phone: str | None
    email: EmailStr | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeacherUpdate(BaseModel):
    employee_number: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None