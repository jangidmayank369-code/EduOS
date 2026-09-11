from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReportCardAssessmentMark(BaseModel):
    id: str
    label: str
    assessment: str | None = None
    component: str = "OTHER"
    exam_id: int
    exam_name: str | None = None
    max_marks: float = 0
    pass_marks: float = 0
    marks_obtained: float | None = None
    percentage: float | None = None
    grade: str | None = None
    is_pass: bool | None = None
    remark: str | None = None


class ReportCardAcademicSubject(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str | None = None
    max_marks: float = 0
    pass_marks: float = 0
    marks_obtained: float | None = None
    percentage: float | None = None
    grade: str | None = None
    remark: str | None = None
    is_optional: bool = False
    include_in_result: bool = True
    is_pass: bool | None = None

    # New WPS/assessment-aware fields.
    assessments: list[ReportCardAssessmentMark] = Field(default_factory=list)
    calculation_complete: bool = True
    marked_assessments: int = 0
    total_assessments: int = 0


class ReportCardAttendance(BaseModel):
    total_days: int = 0
    present_days: int = 0
    absent_days: int = 0
    percentage: float | None = None


class ReportCardCoScholasticItem(BaseModel):
    name: str
    value: str | None = None
    grade: str | None = None
    remark: str | None = None


class ReportCardResultSummary(BaseModel):
    total_marks: float | None = None
    max_marks: float | None = None
    percentage: float | None = None
    grade: str | None = None
    rank: int | None = None
    is_pass: bool | None = None

    calculation_complete: bool = True
    missing_assessments: int = 0


class ReportCardStudentResponse(BaseModel):
    id: int
    admission_number: str | None = None
    name: str
    first_name: str | None = None
    last_name: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    class_id: int | None = None
    class_name: str | None = None
    section: str | None = None
    roll_no: str | None = None
    academic_session: str | None = None


class ReportCardResponse(BaseModel):
    template: dict[str, Any]
    student: ReportCardStudentResponse
    exam: dict[str, Any] | None = None
    academic_session: dict[str, Any] | None = None
    academic_subjects: list[ReportCardAcademicSubject] = Field(
        default_factory=list
    )
    co_scholastic: list[ReportCardCoScholasticItem] = Field(
        default_factory=list
    )
    result: ReportCardResultSummary = Field(
        default_factory=ReportCardResultSummary
    )
    attendance: ReportCardAttendance = Field(
        default_factory=ReportCardAttendance
    )
    class_teacher_remark: str | None = None
    principal_remark: str | None = None

    model_config = ConfigDict(from_attributes=True)
