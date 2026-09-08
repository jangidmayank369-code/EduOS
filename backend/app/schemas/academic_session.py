from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class AcademicSessionCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=20)
    start_date: date
    end_date: date
    is_active: bool = False

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("End date must be after start date")
        return self


class AcademicSessionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=20)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date <= self.start_date
        ):
            raise ValueError("End date must be after start date")
        return self


class AcademicSessionResponse(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}