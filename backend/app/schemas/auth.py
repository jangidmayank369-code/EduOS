from pydantic import BaseModel, EmailStr
from typing import Literal


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: Literal["admin", "teacher", "student", "parent"]
class RegisterResponse(BaseModel):
    id: int
    email: EmailStr
    role: Literal["admin", "teacher", "student", "parent"]
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
class LoginResponse(BaseModel):
    access_token: str
    token_type: str