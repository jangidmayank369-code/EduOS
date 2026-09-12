from pydantic import BaseModel, ConfigDict, Field


class SectionTimetableCreate(BaseModel):
    section_id: int = Field(gt=0)
    period_id: int = Field(gt=0)
    day_of_week: int = Field(ge=1, le=7)
    subject_id: int | None = Field(default=None, gt=0)
    teacher_id: int | None = Field(default=None, gt=0)
    room_number: str | None = Field(default=None, max_length=50)


class SectionTimetableUpdate(BaseModel):
    period_id: int | None = Field(default=None, gt=0)
    day_of_week: int | None = Field(default=None, ge=1, le=7)
    subject_id: int | None = Field(default=None, gt=0)
    teacher_id: int | None = Field(default=None, gt=0)
    room_number: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class SectionTimetableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    period_id: int
    day_of_week: int
    subject_id: int | None
    teacher_id: int | None
    room_number: str | None
    is_active: bool