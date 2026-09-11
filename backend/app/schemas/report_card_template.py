from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReportCardTemplateBase(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=150
    )

    description: str | None = None

    class_id: int | None = None

    academic_session_id: int | None = None

    exam_id: int | None = None

    page_size: str = "A4"

    orientation: str = "portrait"

    status: str = "DRAFT"

    is_default: bool = False

    elements: list[dict[str, Any]] = Field(
        default_factory=list
    )

    settings: dict[str, Any] = Field(
        default_factory=dict
    )


class ReportCardTemplateCreate(
    ReportCardTemplateBase
):
    pass


class ReportCardTemplateUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150
    )

    description: str | None = None

    class_id: int | None = None

    academic_session_id: int | None = None

    exam_id: int | None = None

    page_size: str | None = None

    orientation: str | None = None

    status: str | None = None

    is_default: bool | None = None

    elements: list[dict[str, Any]] | None = None

    settings: dict[str, Any] | None = None


class ReportCardTemplateResponse(
    ReportCardTemplateBase
):
    id: int

    created_by: int

    created_at: datetime

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class ReportCardTemplateDuplicateRequest(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150
    )


class ReportCardTemplateDefaultResponse(BaseModel):
    id: int

    is_default: bool

    model_config = ConfigDict(
        from_attributes=True
    )