from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AssignmentCreate(BaseModel):
    class_id: int
    subject_id: int
    teacher_id: int
    title: str
    description: str | None = None
    due_date: datetime
    max_marks: float


class AssignmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: datetime | None = None
    max_marks: float | None = None
    is_active: bool | None = None


class AssignmentResponse(BaseModel):
    id: int
    class_id: int
    subject_id: int
    teacher_id: int
    title: str
    description: str | None
    due_date: datetime
    max_marks: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)