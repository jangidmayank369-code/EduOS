from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


CO_SCHOLASTIC_TYPES = {
    "MARKS",
    "GRADE",
    "REMARK",
}


class CoScholasticComponentBase(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    component_type: str = "GRADE"

    max_marks: float | None = Field(
        default=None,
        ge=0,
    )

    include_in_result: bool = False

    display_order: int = Field(
        default=0,
        ge=0,
    )

    is_active: bool = True

    @field_validator("component_type")
    @classmethod
    def validate_component_type(cls, value: str) -> str:
        value = value.strip().upper()

        if value not in CO_SCHOLASTIC_TYPES:
            raise ValueError(
                f"Invalid component_type. "
                f"Allowed values: {', '.join(sorted(CO_SCHOLASTIC_TYPES))}"
            )

        return value


class CoScholasticComponentCreate(CoScholasticComponentBase):
    class_id: int


class CoScholasticComponentUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    component_type: str | None = None

    max_marks: float | None = Field(
        default=None,
        ge=0,
    )

    include_in_result: bool | None = None

    display_order: int | None = Field(
        default=None,
        ge=0,
    )

    is_active: bool | None = None

    @field_validator("component_type")
    @classmethod
    def validate_component_type(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip().upper()

        if value not in CO_SCHOLASTIC_TYPES:
            raise ValueError(
                f"Invalid component_type. "
                f"Allowed values: {', '.join(sorted(CO_SCHOLASTIC_TYPES))}"
            )

        return value


class CoScholasticComponentResponse(CoScholasticComponentBase):
    id: int
    class_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class CoScholasticEntryBase(BaseModel):
    component_id: int
    student_id: int

    marks: float | None = Field(
        default=None,
        ge=0,
    )

    grade: str | None = Field(
        default=None,
        max_length=20,
    )

    remark: str | None = Field(
        default=None,
        max_length=255,
    )


class CoScholasticEntryCreate(CoScholasticEntryBase):
    pass


class CoScholasticEntryUpdate(BaseModel):
    marks: float | None = Field(
        default=None,
        ge=0,
    )

    grade: str | None = Field(
        default=None,
        max_length=20,
    )

    remark: str | None = Field(
        default=None,
        max_length=255,
    )


class CoScholasticEntryResponse(CoScholasticEntryBase):
    id: int

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class CoScholasticStudentResult(BaseModel):
    component_id: int
    component_name: str

    component_type: str

    marks: float | None
    max_marks: float | None

    grade: str | None
    remark: str | None

    model_config = ConfigDict(
        from_attributes=True,
    )


class CoScholasticBulkItem(BaseModel):
    student_id: int

    marks: float | None = Field(
        default=None,
        ge=0,
    )

    grade: str | None = Field(
        default=None,
        max_length=20,
    )

    remark: str | None = Field(
        default=None,
        max_length=255,
    )


class CoScholasticBulkRequest(BaseModel):
    component_id: int

    items: list[CoScholasticBulkItem] = Field(
        default_factory=list,
    )