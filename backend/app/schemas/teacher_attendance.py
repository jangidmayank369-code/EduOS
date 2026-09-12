from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TeacherLeaveCreate(BaseModel):
    leave_type: str = Field(default="CASUAL", min_length=1, max_length=30)
    start_date: date
    end_date: date
    reason: str | None = None
    remarks: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date.")
        return self


class TeacherLeaveUpdate(BaseModel):
    leave_type: str | None = Field(default=None, min_length=1, max_length=30)
    start_date: date | None = None
    end_date: date | None = None
    reason: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=30)
    remarks: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date.")
        return self


class TeacherLeaveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    leave_type: str
    start_date: date
    end_date: date
    reason: str | None
    status: str
    reviewed_by_user_id: int | None
    reviewed_at: datetime | None
    remarks: str | None
    created_at: datetime
    updated_at: datetime


class TeacherAttendanceCreate(BaseModel):
    attendance_date: date
    status: str = Field(default="PRESENT", min_length=1, max_length=30)
    check_in: time | None = None
    check_out: time | None = None
    leave_id: int | None = Field(default=None, gt=0)
    remarks: str | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.check_in and self.check_out and self.check_out < self.check_in:
            raise ValueError("Check-out time cannot be before check-in time.")
        return self


class TeacherAttendanceUpdate(BaseModel):
    attendance_date: date | None = None
    status: str | None = Field(default=None, min_length=1, max_length=30)
    check_in: time | None = None
    check_out: time | None = None
    leave_id: int | None = Field(default=None, gt=0)
    remarks: str | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.check_in and self.check_out and self.check_out < self.check_in:
            raise ValueError("Check-out time cannot be before check-in time.")
        return self


class TeacherAttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    attendance_date: date
    status: str
    check_in: time | None
    check_out: time | None
    leave_id: int | None
    remarks: str | None
    created_at: datetime
    updated_at: datetime
