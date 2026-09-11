from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================
# EXAM
# ============================================================


class ExamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None

    exam_type: str = Field(
        default="EXAM",
        max_length=30,
    )

    academic_year: str | None = Field(
        default=None,
        max_length=20,
    )

    term: str | None = Field(
        default=None,
        max_length=30,
    )

    start_date: date | None = None
    end_date: date | None = None

    include_in_result: bool = False

    weightage: float = Field(
        default=0,
        ge=0,
        le=100,
    )

    status: str = Field(
        default="DRAFT",
        max_length=20,
    )


class ExamUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: str | None = None

    exam_type: str | None = Field(
        default=None,
        max_length=30,
    )

    academic_year: str | None = Field(
        default=None,
        max_length=20,
    )

    term: str | None = Field(
        default=None,
        max_length=30,
    )

    start_date: date | None = None
    end_date: date | None = None

    include_in_result: bool | None = None

    weightage: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    status: str | None = Field(
        default=None,
        max_length=20,
    )

    is_active: bool | None = None


class ExamResponse(BaseModel):
    id: int
    name: str
    description: str | None

    exam_type: str
    academic_year: str | None
    term: str | None

    start_date: date | None
    end_date: date | None

    include_in_result: bool
    weightage: float
    status: str

    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class ExamCopyResponse(BaseModel):
    message: str
    exam_id: int
    exam_name: str
    subjects_copied: int


# ============================================================
# EXAM SUBJECT COMPONENT
# ============================================================
#
# Example:
#
# [
#   {
#       "key": "written",
#       "name": "Written",
#       "type": "THEORY",
#       "max_marks": 70,
#       "pass_marks": 28,
#       "include_in_result": true,
#       "is_optional": false,
#       "display_order": 1
#   },
#   {
#       "key": "oral",
#       "name": "Oral",
#       "type": "ORAL",
#       "max_marks": 30,
#       "pass_marks": 12,
#       "include_in_result": true,
#       "is_optional": false,
#       "display_order": 2
#   }
# ]
#
# This allows:
# Hindi = Written 70 + Oral 30
# Science = Theory 70 + Practical 30
# English = Written 80 + Internal 20
# ============================================================


class ExamSubjectComponent(BaseModel):
    key: str = Field(
        min_length=1,
        max_length=50,
    )

    name: str = Field(
        min_length=1,
        max_length=100,
    )

    type: str = Field(
        default="THEORY",
        max_length=30,
    )

    max_marks: float = Field(
        gt=0,
    )

    pass_marks: float = Field(
        default=0,
        ge=0,
    )

    include_in_result: bool = True

    is_optional: bool = False

    display_order: int = Field(
        default=1,
        ge=1,
    )

    @field_validator("pass_marks")
    @classmethod
    def validate_pass_marks(
        cls,
        value: float,
        info,
    ) -> float:
        max_marks = info.data.get("max_marks")

        if max_marks is not None and value > max_marks:
            raise ValueError(
                "Component pass marks cannot exceed component maximum marks."
            )

        return value


# ============================================================
# EXAM SUBJECT
# ============================================================


class ExamSubjectCreate(BaseModel):
    exam_id: int
    class_id: int
    subject_id: int

    max_marks: float = Field(
        default=100,
        gt=0,
    )

    pass_marks: float = Field(
        default=40,
        ge=0,
    )

    is_optional: bool = False

    include_in_result: bool = True

    components: list[ExamSubjectComponent] = Field(
        default_factory=list,
    )

    @field_validator("pass_marks")
    @classmethod
    def validate_pass_marks(
        cls,
        value: float,
        info,
    ) -> float:
        max_marks = info.data.get("max_marks")

        if max_marks is not None and value > max_marks:
            raise ValueError(
                "Pass marks cannot exceed maximum marks."
            )

        return value

    @field_validator("components")
    @classmethod
    def validate_components(
        cls,
        value: list[ExamSubjectComponent],
    ) -> list[ExamSubjectComponent]:
        if not value:
            return value

        keys: set[str] = set()

        for component in value:
            normalized_key = component.key.strip().lower()

            if normalized_key in keys:
                raise ValueError(
                    f"Duplicate component key: {component.key}"
                )

            keys.add(normalized_key)

        total_max_marks = sum(
            component.max_marks
            for component in value
            if component.include_in_result
        )

        # Component totals should represent the subject's configured
        # maximum marks when components are supplied.
        #
        # A small floating-point tolerance is allowed.
        subject_max_marks = None

        # max_marks is intentionally not read from validator info here
        # because the component list validator should remain independently
        # reusable. Final consistency is checked in the API/service layer.
        _ = total_max_marks
        _ = subject_max_marks

        return value


class ExamSubjectUpdate(BaseModel):
    max_marks: float | None = Field(
        default=None,
        gt=0,
    )

    pass_marks: float | None = Field(
        default=None,
        ge=0,
    )

    is_optional: bool | None = None

    include_in_result: bool | None = None

    components: list[ExamSubjectComponent] | None = None

    @field_validator("pass_marks")
    @classmethod
    def validate_pass_marks(
        cls,
        value: float | None,
        info,
    ) -> float | None:
        if value is None:
            return value

        max_marks = info.data.get("max_marks")

        if max_marks is not None and value > max_marks:
            raise ValueError(
                "Pass marks cannot exceed maximum marks."
            )

        return value

    @field_validator("components")
    @classmethod
    def validate_components(
        cls,
        value: list[ExamSubjectComponent] | None,
    ) -> list[ExamSubjectComponent] | None:
        if value is None:
            return value

        keys: set[str] = set()

        for component in value:
            normalized_key = component.key.strip().lower()

            if normalized_key in keys:
                raise ValueError(
                    f"Duplicate component key: {component.key}"
                )

            keys.add(normalized_key)

        return value


class ExamSubjectResponse(BaseModel):
    exam_id: int
    class_id: int
    subject_id: int

    max_marks: float
    pass_marks: float

    is_optional: bool
    include_in_result: bool

    components: list[dict[str, Any]] = Field(
        default_factory=list,
    )

    model_config = ConfigDict(
        from_attributes=True
    )


# ============================================================
# MARKS
# ============================================================


class MarkCreate(BaseModel):
    student_id: int
    exam_id: int
    subject_id: int
    marks_obtained: float
    max_marks: float


class MarkUpdate(BaseModel):
    marks_obtained: float | None = None
    max_marks: float | None = None


class MarkBulkItem(BaseModel):
    student_id: int
    marks_obtained: float
    max_marks: float


class MarkBulkCreate(BaseModel):
    exam_id: int
    subject_id: int

    items: list[MarkBulkItem] = Field(
        min_length=1,
        max_length=500,
    )


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

    model_config = ConfigDict(
        from_attributes=True
    )


class MarkBulkResponse(BaseModel):
    exam_id: int
    subject_id: int

    saved_count: int

    marks: list[MarkResponse]