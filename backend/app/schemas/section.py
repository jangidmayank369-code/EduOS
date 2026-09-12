from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SectionCreate(BaseModel):
    name: str
    class_teacher_id: int | None = None


class SectionUpdate(BaseModel):
    name: str | None = None
    class_teacher_id: int | None = None


class SectionResponse(BaseModel):
    id: int
    class_id: int
    name: str
    class_teacher_id: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
