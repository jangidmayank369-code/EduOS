from datetime import datetime, time

from pydantic import BaseModel, ConfigDict


class TimetableCreate(BaseModel):
    class_id: int
    subject_id: int
    teacher_id: int
    day_of_week: int
    start_time: time
    end_time: time
    room_number: str | None = None


class TimetableUpdate(BaseModel):
    class_id: int | None = None
    subject_id: int | None = None
    teacher_id: int | None = None
    day_of_week: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room_number: str | None = None


class TimetableResponse(BaseModel):
    id: int
    class_id: int
    subject_id: int
    teacher_id: int
    day_of_week: int
    start_time: time
    end_time: time
    room_number: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)