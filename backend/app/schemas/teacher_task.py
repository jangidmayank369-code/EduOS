from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_TASK_TYPES = {
    "GENERAL",
    "ACADEMIC",
    "ADMINISTRATIVE",
    "EVENT",
    "STUDENT_SUPPORT",
    "EXAM",
    "OTHER",
}

ALLOWED_PRIORITIES = {
    "LOW",
    "MEDIUM",
    "HIGH",
    "URGENT",
}

ALLOWED_STATUSES = {
    "ASSIGNED",
    "IN_PROGRESS",
    "SUBMITTED",
    "REWORK",
    "APPROVED",
    "CANCELLED",
    "CLOSED",
}


class TeacherTaskCreate(BaseModel):
    teacher_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    task_type: str = Field(default="GENERAL", min_length=1, max_length=40)
    priority: str = Field(default="MEDIUM", min_length=1, max_length=20)
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be empty.")
        return value

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in ALLOWED_TASK_TYPES:
            raise ValueError(
                "Invalid task type. Allowed values: "
                + ", ".join(sorted(ALLOWED_TASK_TYPES))
            )
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in ALLOWED_PRIORITIES:
            raise ValueError(
                "Invalid priority. Allowed values: "
                + ", ".join(sorted(ALLOWED_PRIORITIES))
            )
        return value


class TeacherTaskAdminUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    teacher_id: int | None = Field(default=None, gt=0)
    task_type: str | None = Field(default=None, min_length=1, max_length=40)
    priority: str | None = Field(default=None, min_length=1, max_length=20)
    due_date: date | None = None
    status: str | None = None
    admin_remarks: str | None = Field(default=None, max_length=10000)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be empty.")
        return value

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if value not in ALLOWED_TASK_TYPES:
            raise ValueError(
                "Invalid task type. Allowed values: "
                + ", ".join(sorted(ALLOWED_TASK_TYPES))
            )
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if value not in ALLOWED_PRIORITIES:
            raise ValueError(
                "Invalid priority. Allowed values: "
                + ", ".join(sorted(ALLOWED_PRIORITIES))
            )
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        if value not in ALLOWED_STATUSES:
            raise ValueError(
                "Invalid status. Allowed values: "
                + ", ".join(sorted(ALLOWED_STATUSES))
            )
        return value


class TeacherTaskProgressUpdate(BaseModel):
    progress_percent: int = Field(ge=0, le=100)
    status: str | None = None
    teacher_remarks: str | None = Field(default=None, max_length=10000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().upper()
        allowed = {
            "ASSIGNED",
            "IN_PROGRESS",
            "SUBMITTED",
            "REWORK",
        }
        if value not in allowed:
            raise ValueError(
                "Teachers may use only ASSIGNED, IN_PROGRESS, SUBMITTED, or REWORK."
            )
        return value


class TeacherTaskReview(BaseModel):
    status: str
    admin_remarks: str | None = Field(default=None, max_length=10000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in {"REWORK", "APPROVED", "CANCELLED", "CLOSED"}:
            raise ValueError(
                "Invalid review status. Allowed: REWORK, APPROVED, CANCELLED, CLOSED."
            )
        return value


class TeacherTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    assigned_by_user_id: int
    title: str
    description: str | None
    task_type: str
    priority: str
    status: str
    progress_percent: int
    due_date: date | None
    started_at: datetime | None
    submitted_at: datetime | None
    reviewed_at: datetime | None
    reviewed_by_user_id: int | None
    teacher_remarks: str | None
    admin_remarks: str | None
    created_at: datetime
    updated_at: datetime
