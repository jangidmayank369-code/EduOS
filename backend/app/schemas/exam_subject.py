from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExamSubjectComponent(BaseModel):
    """
    Configurable marks component for an exam subject.

    Example:
        Written  -> 70 marks
        Oral     -> 30 marks
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
        max_length=30,
    )

    max_marks: float = Field(
        gt=0,
    )

    pass_marks: float = Field(
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
                "Component pass marks cannot be greater than component max marks."
            )

        return value


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
                "Subject pass marks cannot be greater than subject max marks."
            )

        return value

    @field_validator("components")
    @classmethod
    def validate_components(
        cls,
        value: list[ExamSubjectComponent],
    ) -> list[ExamSubjectComponent]:
        keys = [component.key.strip().lower() for component in value]

        if len(keys) != len(set(keys)):
            raise ValueError(
                "Component keys must be unique within a subject."
            )

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

    @field_validator("components")
    @classmethod
    def validate_components(
        cls,
        value: list[ExamSubjectComponent] | None,
    ) -> list[ExamSubjectComponent] | None:
        if value is None:
            return None

        keys = [component.key.strip().lower() for component in value]

        if len(keys) != len(set(keys)):
            raise ValueError(
                "Component keys must be unique within a subject."
            )

        return value


class ExamSubjectResponse(BaseModel):
    exam_id: int

    class_id: int

    subject_id: int

    max_marks: float

    pass_marks: float

    is_optional: bool

    include_in_result: bool

    components: list[ExamSubjectComponent] = Field(
        default_factory=list,
    )

    model_config = ConfigDict(
        from_attributes=True,
    )