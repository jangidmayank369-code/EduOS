from datetime import time

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TimetablePeriodCreate(BaseModel):
    period_number: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=50)
    start_time: time
    end_time: time
    is_break: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Period name cannot be empty.")

        return value

    @field_validator("end_time")
    @classmethod
    def validate_end_time(
        cls,
        value: time,
        info,
    ) -> time:
        start_time = info.data.get("start_time")

        if start_time is not None and value <= start_time:
            raise ValueError("End time must be after start time.")

        return value


class TimetablePeriodUpdate(BaseModel):
    period_number: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=50)
    start_time: time | None = None
    end_time: time | None = None
    is_break: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()

        if not value:
            raise ValueError("Period name cannot be empty.")

        return value


class TimetablePeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_number: int
    name: str
    start_time: time
    end_time: time
    is_break: bool
    is_active: bool