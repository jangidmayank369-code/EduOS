from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ExamCreate(BaseModel):
    name: str
    description: str | None = None


class ExamUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class ExamResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)