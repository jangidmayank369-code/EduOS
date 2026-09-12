from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TeacherAccountCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TeacherAccountUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None


class TeacherAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    teacher_id: int
    user_id: int
    email: EmailStr
    role: str
    role_id: int | None
    is_active: bool
