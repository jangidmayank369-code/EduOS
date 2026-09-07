from datetime import datetime

from pydantic import BaseModel


class ClassCreate(BaseModel):
    name: str
    description: str | None = None
class ClassUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
class ClassSummary(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
class ClassResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }