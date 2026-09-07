from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str
class RegisterResponse(BaseModel):
    id: int
    email: EmailStr
    role: str