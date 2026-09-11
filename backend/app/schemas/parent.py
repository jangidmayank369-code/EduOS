from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class ParentCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None


class ParentUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None


class ParentResponse(BaseModel):
    id: int
    user_id: int
    first_name: str
    last_name: str
    phone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)