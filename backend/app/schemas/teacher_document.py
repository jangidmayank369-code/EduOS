from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


DOCUMENT_TYPES = {
    "AADHAAR",
    "PAN",
    "PASSPORT",
    "DRIVING_LICENSE",
    "VOTER_ID",
    "QUALIFICATION",
    "EXPERIENCE",
    "JOINING_LETTER",
    "RELIEVING_LETTER",
    "ADDRESS_PROOF",
    "BANK_PROOF",
    "CONTRACT",
    "OTHER",
}


class TeacherDocumentCreate(BaseModel):
    document_type: str = Field(min_length=1, max_length=50)
    document_name: str = Field(min_length=1, max_length=200)
    document_number: str | None = Field(default=None, max_length=100)
    issue_date: date | None = None
    expiry_date: date | None = None
    file_url: str | None = None
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=100)
    is_verified: bool = False
    remarks: str | None = None

    @field_validator("document_type", mode="before")
    @classmethod
    def normalize_type(cls, value):
        return str(value).strip().upper()

    @field_validator("document_name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        return str(value).strip()

    @field_validator("document_number", mode="before")
    @classmethod
    def normalize_number(cls, value):
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("expiry_date")
    @classmethod
    def validate_dates(cls, value, info):
        issue_date = info.data.get("issue_date")
        if value and issue_date and value < issue_date:
            raise ValueError("expiry_date cannot be before issue_date")
        return value


class TeacherDocumentUpdate(BaseModel):
    document_type: str | None = Field(default=None, min_length=1, max_length=50)
    document_name: str | None = Field(default=None, min_length=1, max_length=200)
    document_number: str | None = Field(default=None, max_length=100)
    issue_date: date | None = None
    expiry_date: date | None = None
    file_url: str | None = None
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=100)
    is_verified: bool | None = None
    remarks: str | None = None
    is_active: bool | None = None

    @field_validator("document_type", mode="before")
    @classmethod
    def normalize_type(cls, value):
        if value is None:
            return None
        return str(value).strip().upper()

    @field_validator("document_name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        if value is None:
            return None
        return str(value).strip()

    @field_validator("document_number", mode="before")
    @classmethod
    def normalize_number(cls, value):
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("expiry_date")
    @classmethod
    def validate_dates(cls, value, info):
        issue_date = info.data.get("issue_date")
        if value and issue_date and value < issue_date:
            raise ValueError("expiry_date cannot be before issue_date")
        return value


class TeacherDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    document_type: str
    document_name: str
    document_number: str | None
    issue_date: date | None
    expiry_date: date | None
    file_url: str | None
    file_name: str | None
    mime_type: str | None
    is_verified: bool
    verified_by_user_id: int | None
    verified_at: object | None
    is_active: bool
    remarks: str | None
