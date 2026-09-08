from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FeeCreate(BaseModel):
    student_id: int
    title: str
    amount_due: float


class FeeUpdate(BaseModel):
    title: str | None = None
    amount_due: float | None = None
    amount_paid: float | None = None
    status: str | None = None


class FeeResponse(BaseModel):
    id: int
    student_id: int
    title: str
    amount_due: float
    amount_paid: float
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
class FeeSummaryResponse(BaseModel):
    student_id: int
    total_due: float
    total_paid: float
    total_pending: float