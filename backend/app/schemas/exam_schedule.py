from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


VALID_SHIFTS = {
    "MORNING",
    "AFTERNOON",
    "EVENING",
}


class ExamScheduleCreate(BaseModel):
    exam_id: int
    class_id: int
    subject_id: int

    exam_date: date

    shift: str = Field(
        default="MORNING",
        max_length=20,
    )

    start_time: time
    end_time: time

    room: str | None = Field(
        default=None,
        max_length=100,
    )

    instructions: str | None = None

    @model_validator(mode="after")
    def validate_schedule(self):
        self.shift = self.shift.upper()

        if self.shift not in VALID_SHIFTS:
            raise ValueError(
                "Invalid shift. Use MORNING, AFTERNOON or EVENING."
            )

        if self.end_time <= self.start_time:
            raise ValueError(
                "End time must be later than start time."
            )

        return self


class ExamScheduleUpdate(BaseModel):
    class_id: int | None = None
    subject_id: int | None = None

    exam_date: date | None = None

    shift: str | None = Field(
        default=None,
        max_length=20,
    )

    start_time: time | None = None
    end_time: time | None = None

    room: str | None = Field(
        default=None,
        max_length=100,
    )

    instructions: str | None = None

    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.shift is not None:
            self.shift = self.shift.upper()

            if self.shift not in VALID_SHIFTS:
                raise ValueError(
                    "Invalid shift. Use MORNING, AFTERNOON or EVENING."
                )

        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError(
                "End time must be later than start time."
            )

        return self


class ExamScheduleResponse(BaseModel):
    id: int

    exam_id: int
    class_id: int
    subject_id: int

    exam_date: date

    shift: str

    start_time: time
    end_time: time

    room: str | None
    instructions: str | None

    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)