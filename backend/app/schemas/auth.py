from typing import Literal

from pydantic import BaseModel, EmailStr


UserRole = Literal[
    "admin",
    "teacher",
    "student",
    "parent",
    "accountant",
    "receptionist",
]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: UserRole


class RegisterResponse(BaseModel):
    id: int
    email: EmailStr
    role: UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str