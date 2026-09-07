from datetime import datetime

from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    code: str
    description: str | None = None


class SubjectResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubjectUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    