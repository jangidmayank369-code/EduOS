from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class AttendanceCreate(BaseModel):
    student_id: int
    date: date
    status: str


class AttendanceResponse(BaseModel):
    id: int
    student_id: int
    date: date
    status: str
    marked_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)