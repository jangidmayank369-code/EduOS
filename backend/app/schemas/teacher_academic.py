from datetime import time

from pydantic import BaseModel, ConfigDict, Field


class TeacherAcademicSection(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    section_id: int
    section_name: str
    class_id: int
    class_name: str
    subject_id: int
    subject_name: str
    subject_code: str
    is_class_teacher: bool


class TeacherAcademicTimetableEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timetable_id: int
    section_id: int
    section_name: str
    class_id: int
    class_name: str
    day_of_week: int = Field(ge=1, le=7)
    period_id: int
    period_number: int
    period_name: str
    start_time: time
    end_time: time
    is_break: bool
    subject_id: int | None
    subject_name: str | None
    subject_code: str | None
    teacher_id: int | None
    room_number: str | None


class TeacherAcademicProfileResponse(BaseModel):
    teacher_id: int
    employee_number: str | None
    teacher_name: str
    sections: list[TeacherAcademicSection]
    timetable: list[TeacherAcademicTimetableEntry]
    total_subject_assignments: int
    total_sections: int
    class_teacher_sections: int
    weekly_timetable_periods: int
