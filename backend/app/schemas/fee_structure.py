from datetime import datetime

from pydantic import BaseModel, Field


class FeeStructureCreate(BaseModel):
    academic_session_id: int = Field(gt=0)
    class_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    amount: float = Field(gt=0)
    frequency: str = Field(default="YEARLY", min_length=1, max_length=30)
    due_day: int | None = Field(default=None, ge=1, le=31)


class FeeStructureUpdate(BaseModel):
    academic_session_id: int | None = Field(default=None, gt=0)
    class_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    amount: float | None = Field(default=None, gt=0)
    frequency: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )
    due_day: int | None = Field(default=None, ge=1, le=31)
    is_active: bool | None = None


class FeeStructureResponse(BaseModel):
    id: int
    academic_session_id: int
    class_id: int
    name: str
    description: str | None
    amount: float
    frequency: str
    due_day: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}