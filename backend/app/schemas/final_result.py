from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


CALCULATION_METHODS = {
    "WEIGHTED",
    "AVERAGE",
    "BEST_OF",
}


class ResultConfigurationExamCreate(BaseModel):
    exam_id: int

    weightage: float = Field(
        default=0,
        ge=0,
        le=100,
    )

    include_in_result: bool = True


class ResultConfigurationCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=150,
    )

    class_id: int

    academic_session_id: int | None = None

    term: str | None = Field(
        default=None,
        max_length=50,
    )

    calculation_method: str = "WEIGHTED"

    best_of_count: int | None = Field(
        default=None,
        ge=1,
    )

    exams: list[ResultConfigurationExamCreate] = Field(
        default_factory=list,
    )


class ResultConfigurationUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    term: str | None = Field(
        default=None,
        max_length=50,
    )

    calculation_method: str | None = None

    best_of_count: int | None = Field(
        default=None,
        ge=1,
    )

    is_active: bool | None = None


class ResultConfigurationExamResponse(BaseModel):
    id: int
    exam_id: int
    weightage: float
    include_in_result: bool

    model_config = ConfigDict(
        from_attributes=True,
    )


class ResultConfigurationResponse(BaseModel):
    id: int
    name: str
    class_id: int
    academic_session_id: int | None
    term: str | None
    calculation_method: str
    best_of_count: int | None
    status: str
    is_active: bool
    published_at: datetime | None

    exams: list[ResultConfigurationExamResponse]

    model_config = ConfigDict(
        from_attributes=True,
    )


class ResultSubjectPreview(BaseModel):
    subject_id: int
    subject_name: str

    total_marks: float
    max_marks: float

    percentage: float
    grade: str

    is_pass: bool

    missing_exams: list[int] = Field(
        default_factory=list,
    )


class FinalResultPreview(BaseModel):
    student_id: int
    student_name: str

    subjects: list[ResultSubjectPreview]

    total_marks: float
    max_marks: float

    percentage: float
    grade: str

    rank: int | None

    is_pass: bool

    missing_marks: bool

    missing_exam_ids: list[int] = Field(
        default_factory=list,
    )


class FinalResultSubjectResponse(BaseModel):
    id: int

    subject_id: int

    total_marks: float
    max_marks: float

    percentage: float
    grade: str

    is_pass: bool

    model_config = ConfigDict(
        from_attributes=True,
    )


class FinalResultResponse(BaseModel):
    id: int

    configuration_id: int
    student_id: int

    total_marks: float
    max_marks: float

    percentage: float
    grade: str

    rank: int | None

    is_pass: bool

    is_locked: bool
    is_published: bool

    published_at: datetime | None

    subjects: list[FinalResultSubjectResponse]

    model_config = ConfigDict(
        from_attributes=True,
    )