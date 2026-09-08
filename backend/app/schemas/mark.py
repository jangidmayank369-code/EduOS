from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MarkCreate(BaseModel):
    student_id: int
    exam_id: int
    subject_id: int
    marks_obtained: float
    max_marks: float


class MarkUpdate(BaseModel):
    marks_obtained: float | None = None
    max_marks: float | None = None


class MarkResponse(BaseModel):
    id: int
    student_id: int
    exam_id: int
    subject_id: int
    marks_obtained: float
    max_marks: float
    entered_by: int
    created_at: datetime
    updated_at: datetime
    percentage: float
    grade: str

    model_config = ConfigDict(from_attributes=True)