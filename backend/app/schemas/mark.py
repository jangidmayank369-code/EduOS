from datetime import date, datetime, time
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ============================================================
# Shared / Component Schemas
# ============================================================


class ExamComponent(BaseModel):
    """
    Configurable marks component inside an ExamSubject.

    Example:
        Written -> 70 marks
        Oral    -> 30 marks

    This allows subjects such as Hindi to have:
        - Written
        - Oral
        - Practical
        - Internal
        - Theory

    without hard-coding the component structure.
    """

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
        min_length=1,
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

    @model_validator(mode="after")
    def validate_pass_marks(self):
        if self.pass_marks > self.max_marks:
            raise ValueError(
                "pass_marks cannot be greater than max_marks"
            )

        return self


# ============================================================
# Exam Schemas
# ============================================================


class ExamBase(BaseModel):
    """
    Common fields used when creating or updating an examination.
    """

    name: str = Field(
        min_length=1,
        max_length=100,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    exam_type: str = Field(
        default="EXAM",
        min_length=1,
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
        default=0.0,
        ge=0,
    )

    status: str = Field(
        default="DRAFT",
        min_length=1,
        max_length=20,
    )

    is_active: bool = True

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError(
                "end_date cannot be earlier than start_date"
            )

        return self


class ExamCreate(ExamBase):
    """
    Payload for creating an examination.
    """

    pass


class ExamUpdate(BaseModel):
    """
    Partial payload for updating an examination.
    """

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    exam_type: str | None = Field(
        default=None,
        min_length=1,
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
    )

    status: str | None = Field(
        default=None,
        min_length=1,
        max_length=20,
    )

    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError(
                "end_date cannot be earlier than start_date"
            )

        return self


class ExamResponse(ExamBase):
    """
    Examination returned by the API.
    """

    id: int

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# Exam Subject Schemas
# ============================================================


class ExamSubjectBase(BaseModel):
    """
    Configuration of one subject for one class inside an exam.
    """

    exam_id: int

    class_id: int

    subject_id: int

    max_marks: float = Field(
        default=100.0,
        gt=0,
    )

    pass_marks: float = Field(
        default=40.0,
        ge=0,
    )

    components: list[ExamComponent] = Field(
        default_factory=list,
        max_length=50,
    )

    is_optional: bool = False

    include_in_result: bool = True

    @model_validator(mode="after")
    def validate_marks_configuration(self):
        if self.pass_marks > self.max_marks:
            raise ValueError(
                "pass_marks cannot be greater than max_marks"
            )

        if self.components:
            component_max_total = sum(
                component.max_marks
                for component in self.components
            )

            if abs(component_max_total - self.max_marks) > 0.001:
                raise ValueError(
                    "The total of component max_marks must equal "
                    "max_marks"
                )

            component_pass_total = sum(
                component.pass_marks
                for component in self.components
            )

            if component_pass_total > self.max_marks:
                raise ValueError(
                    "The total component pass marks cannot be "
                    "greater than max_marks"
                )

        return self


class ExamSubjectCreate(ExamSubjectBase):
    """
    Payload for adding/configuring a subject inside an exam.
    """

    pass


class ExamSubjectUpdate(BaseModel):
    """
    Partial payload for updating subject configuration.
    """

    max_marks: float | None = Field(
        default=None,
        gt=0,
    )

    pass_marks: float | None = Field(
        default=None,
        ge=0,
    )

    components: list[ExamComponent] | None = Field(
        default=None,
        max_length=50,
    )

    is_optional: bool | None = None

    include_in_result: bool | None = None

    @model_validator(mode="after")
    def validate_marks_configuration(self):
        if (
            self.max_marks is not None
            and self.pass_marks is not None
            and self.pass_marks > self.max_marks
        ):
            raise ValueError(
                "pass_marks cannot be greater than max_marks"
            )

        if self.components is not None:
            component_max_total = sum(
                component.max_marks
                for component in self.components
            )

            if (
                self.max_marks is not None
                and abs(component_max_total - self.max_marks) > 0.001
            ):
                raise ValueError(
                    "The total of component max_marks must equal "
                    "max_marks"
                )

        return self


class ExamSubjectResponse(ExamSubjectBase):
    """
    Subject configuration returned by the API.
    """

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# Exam Schedule Schemas
# ============================================================


class ExamScheduleBase(BaseModel):
    """
    Scheduling information for an exam subject.
    """

    exam_id: int

    class_id: int

    subject_id: int

    exam_date: date

    shift: str = Field(
        default="MORNING",
        min_length=1,
        max_length=20,
    )

    start_time: time

    end_time: time

    room: str | None = Field(
        default=None,
        max_length=100,
    )

    instructions: str | None = Field(
        default=None,
        max_length=5000,
    )

    is_active: bool = True

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError(
                "end_time must be later than start_time"
            )

        return self


class ExamScheduleCreate(ExamScheduleBase):
    """
    Payload for creating an exam schedule entry.
    """

    pass


class ExamScheduleUpdate(BaseModel):
    """
    Partial payload for updating an exam schedule entry.
    """

    exam_date: date | None = None

    shift: str | None = Field(
        default=None,
        min_length=1,
        max_length=20,
    )

    start_time: time | None = None

    end_time: time | None = None

    room: str | None = Field(
        default=None,
        max_length=100,
    )

    instructions: str | None = Field(
        default=None,
        max_length=5000,
    )

    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_time_range(self):
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError(
                "end_time must be later than start_time"
            )

        return self


class ExamScheduleResponse(ExamScheduleBase):
    """
    Schedule entry returned by the API.
    """

    id: int

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# Marks Schemas
# ============================================================

# ============================================================
# Assessment Component Mark Schemas
# ============================================================


class MarkComponentValue(BaseModel):
    component_key: str
    component_name: str
    component_type: str = "OTHER"
    marks_obtained: float | None = None
    max_marks: float = Field(gt=0)
    pass_marks: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_component_marks(self):
        if self.marks_obtained is not None:
            if self.marks_obtained < 0:
                raise ValueError("marks_obtained cannot be negative")
            if self.marks_obtained > self.max_marks:
                raise ValueError(
                    "marks_obtained cannot be greater than max_marks"
                )
        if self.pass_marks > self.max_marks:
            raise ValueError("pass_marks cannot be greater than max_marks")
        return self


class MarkComponentBulkItem(BaseModel):
    student_id: int
    marks_obtained: float | None = None

    @model_validator(mode="after")
    def validate_marks(self):
        if self.marks_obtained is not None and self.marks_obtained < 0:
            raise ValueError("marks_obtained cannot be negative")
        return self


class MarkComponentBulkCreate(BaseModel):
    exam_id: int
    subject_id: int
    component_key: str
    items: list[MarkComponentBulkItem] = Field(min_length=1, max_length=500)


class MarkComponentResponse(BaseModel):
    id: int
    mark_id: int
    component_key: str
    component_name: str
    component_type: str
    marks_obtained: float | None
    max_marks: float
    pass_marks: float
    entered_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class MarkComponentsResponse(BaseModel):
    items: list[MarkComponentResponse]




class MarkCreate(BaseModel):
    student_id: int
    exam_id: int
    subject_id: int
    marks_obtained: float
    max_marks: float
    components: list[MarkComponentValue] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_marks(self):
        if self.max_marks <= 0:
            raise ValueError(
                "max_marks must be greater than 0"
            )

        if self.marks_obtained < 0:
            raise ValueError(
                "marks_obtained cannot be negative"
            )

        if self.marks_obtained > self.max_marks:
            raise ValueError(
                "marks_obtained cannot be greater than max_marks"
            )

        return self


class MarkUpdate(BaseModel):
    marks_obtained: float | None = None
    max_marks: float | None = None
    components: list[MarkComponentValue] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_marks(self):
        if (
            self.marks_obtained is not None
            and self.marks_obtained < 0
        ):
            raise ValueError(
                "marks_obtained cannot be negative"
            )

        if (
            self.max_marks is not None
            and self.max_marks <= 0
        ):
            raise ValueError(
                "max_marks must be greater than 0"
            )

        if (
            self.marks_obtained is not None
            and self.max_marks is not None
            and self.marks_obtained > self.max_marks
        ):
            raise ValueError(
                "marks_obtained cannot be greater than max_marks"
            )

        return self


class MarkBulkItem(BaseModel):
    student_id: int
    marks_obtained: float
    max_marks: float

    @model_validator(mode="after")
    def validate_marks(self):
        if self.max_marks <= 0:
            raise ValueError(
                "max_marks must be greater than 0"
            )

        if self.marks_obtained < 0:
            raise ValueError(
                "marks_obtained cannot be negative"
            )

        if self.marks_obtained > self.max_marks:
            raise ValueError(
                "marks_obtained cannot be greater than max_marks"
            )

        return self


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
    components: list[MarkComponentValue] = Field(default_factory=list)

    model_config = ConfigDict(
        from_attributes=True,
    )


class MarkBulkResponse(BaseModel):
    exam_id: int
    subject_id: int
    saved_count: int
    marks: list[MarkResponse]


# ============================================================
# Optional Nested Exam Response
# ============================================================


class ExamDetailResponse(ExamResponse):
    """
    Full exam detail response.

    This is useful for the Exam Details page where the frontend
    needs the exam together with its subject configuration and
    schedule.
    """

    exam_subjects: list[ExamSubjectResponse] = Field(
        default_factory=list,
    )

    exam_schedules: list[ExamScheduleResponse] = Field(
        default_factory=list,
    )