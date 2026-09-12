from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TeacherEmploymentProfileCreate(BaseModel):
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    employment_type: str = Field(default="FULL_TIME", min_length=1, max_length=50)
    employment_status: str = Field(default="ACTIVE", min_length=1, max_length=50)
    joining_date: date | None = None
    confirmation_date: date | None = None
    resignation_date: date | None = None
    last_working_date: date | None = None
    qualification: str | None = Field(default=None, max_length=500)
    specialization: str | None = Field(default=None, max_length=500)
    experience_years: int | None = Field(default=None, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.confirmation_date and self.joining_date:
            if self.confirmation_date < self.joining_date:
                raise ValueError("Confirmation date cannot be before joining date.")

        if self.resignation_date and self.joining_date:
            if self.resignation_date < self.joining_date:
                raise ValueError("Resignation date cannot be before joining date.")

        if self.last_working_date and self.joining_date:
            if self.last_working_date < self.joining_date:
                raise ValueError("Last working date cannot be before joining date.")

        if self.last_working_date and self.resignation_date:
            if self.last_working_date < self.resignation_date:
                raise ValueError("Last working date cannot be before resignation date.")

        return self


class TeacherEmploymentProfileUpdate(BaseModel):
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    employment_type: str | None = Field(default=None, min_length=1, max_length=50)
    employment_status: str | None = Field(default=None, min_length=1, max_length=50)
    joining_date: date | None = None
    confirmation_date: date | None = None
    resignation_date: date | None = None
    last_working_date: date | None = None
    qualification: str | None = Field(default=None, max_length=500)
    specialization: str | None = Field(default=None, max_length=500)
    experience_years: int | None = Field(default=None, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.confirmation_date and self.joining_date:
            if self.confirmation_date < self.joining_date:
                raise ValueError("Confirmation date cannot be before joining date.")

        if self.resignation_date and self.joining_date:
            if self.resignation_date < self.joining_date:
                raise ValueError("Resignation date cannot be before joining date.")

        if self.last_working_date and self.joining_date:
            if self.last_working_date < self.joining_date:
                raise ValueError("Last working date cannot be before joining date.")

        if self.last_working_date and self.resignation_date:
            if self.last_working_date < self.resignation_date:
                raise ValueError("Last working date cannot be before resignation date.")

        return self


class TeacherEmploymentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    designation: str | None
    department: str | None
    employment_type: str
    employment_status: str
    joining_date: date | None
    confirmation_date: date | None
    resignation_date: date | None
    last_working_date: date | None
    qualification: str | None
    specialization: str | None
    experience_years: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

