from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AdmissionApplicationCreate(BaseModel):
    academic_session_id: int
    applying_class_id: int | None = None

    first_name: str = Field(
        min_length=1,
        max_length=100,
    )

    last_name: str = Field(
        min_length=1,
        max_length=100,
    )

    date_of_birth: date | None = None
    gender: str | None = Field(
        default=None,
        max_length=20,
    )

    phone: str | None = Field(
        default=None,
        max_length=20,
    )

    email: EmailStr | None = None

    address: str | None = Field(
        default=None,
        max_length=500,
    )

    parent_first_name: str | None = Field(
        default=None,
        max_length=100,
    )

    parent_last_name: str | None = Field(
        default=None,
        max_length=100,
    )

    parent_phone: str | None = Field(
        default=None,
        max_length=20,
    )

    parent_email: EmailStr | None = None

    parent_relation: str | None = Field(
        default=None,
        max_length=30,
    )

    previous_school_name: str | None = Field(
        default=None,
        max_length=255,
    )

    previous_class: str | None = Field(
        default=None,
        max_length=50,
    )

    previous_school_result: str | None = Field(
        default=None,
        max_length=50,
    )

    remarks: str | None = None


class AdmissionApplicationUpdate(BaseModel):
    academic_session_id: int | None = None
    applying_class_id: int | None = None

    first_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    last_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    date_of_birth: date | None = None
    gender: str | None = Field(
        default=None,
        max_length=20,
    )

    phone: str | None = Field(
        default=None,
        max_length=20,
    )

    email: EmailStr | None = None

    address: str | None = Field(
        default=None,
        max_length=500,
    )

    parent_first_name: str | None = Field(
        default=None,
        max_length=100,
    )

    parent_last_name: str | None = Field(
        default=None,
        max_length=100,
    )

    parent_phone: str | None = Field(
        default=None,
        max_length=20,
    )

    parent_email: EmailStr | None = None

    parent_relation: str | None = Field(
        default=None,
        max_length=30,
    )

    previous_school_name: str | None = Field(
        default=None,
        max_length=255,
    )

    previous_class: str | None = Field(
        default=None,
        max_length=50,
    )

    previous_school_result: str | None = Field(
        default=None,
        max_length=50,
    )

    remarks: str | None = None


class AdmissionStatusUpdate(BaseModel):
    status: str = Field(
        min_length=3,
        max_length=30,
    )

    remarks: str | None = None


class AdmissionApplicationResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    application_number: str

    academic_session_id: int
    applying_class_id: int | None

    # Filled after successful admission conversion.
    student_id: int | None

    first_name: str
    last_name: str

    date_of_birth: date | None
    gender: str | None

    phone: str | None
    email: EmailStr | None
    address: str | None

    parent_first_name: str | None
    parent_last_name: str | None
    parent_phone: str | None
    parent_email: EmailStr | None
    parent_relation: str | None

    previous_school_name: str | None
    previous_class: str | None
    previous_school_result: str | None

    status: str
    remarks: str | None

    reviewed_by_user_id: int | None
    reviewed_at: datetime | None

    created_at: datetime
    updated_at: datetime