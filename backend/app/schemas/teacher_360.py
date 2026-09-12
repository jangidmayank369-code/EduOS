from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class Teacher360BasicProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    teacher_id: int
    employee_number: str | None
    first_name: str
    last_name: str
    phone: str | None
    email: str | None
    is_active: bool


class Teacher360Employment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    experience_years: Decimal | None
    notes: str | None


class Teacher360Section(BaseModel):
    section_id: int
    section_name: str
    class_id: int
    class_name: str
    subject_id: int | None = None
    subject_name: str | None = None
    subject_code: str | None = None
    is_class_teacher: bool = False


class Teacher360TimetableEntry(BaseModel):
    timetable_id: int
    section_id: int
    section_name: str
    day_of_week: str
    period_id: int
    period_number: int
    period_name: str
    start_time: object
    end_time: object
    is_break: bool
    subject_id: int | None = None
    subject_name: str | None = None
    subject_code: str | None = None
    room_number: str | None = None


class Teacher360AttendanceSummary(BaseModel):
    total_records: int
    present: int
    absent: int
    half_day: int
    on_leave: int
    holiday: int
    late: int
    other: int


class Teacher360LeaveSummary(BaseModel):
    total: int
    pending: int
    approved: int
    rejected: int
    cancelled: int


class Teacher360Salary(BaseModel):
    salary_structure_id: int | None
    effective_from: date | None
    effective_to: date | None
    basic_salary: Decimal | None
    allowances: dict
    deductions: dict
    payroll_type: str | None
    is_active: bool | None


class Teacher360PayrollSummary(BaseModel):
    id: int
    payroll_year: int
    payroll_month: int
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: str
    processed_at: datetime | None


class Teacher360PaymentSummary(BaseModel):
    id: int
    payroll_id: int
    payment_date: date
    amount: Decimal
    payment_method: str
    transaction_reference: str | None
    status: str


class Teacher360DocumentSummary(BaseModel):
    id: int
    document_type: str
    document_name: str
    document_number: str | None
    issue_date: date | None
    expiry_date: date | None
    file_url: str | None
    file_name: str | None
    mime_type: str | None
    is_verified: bool
    verified_at: datetime | None
    is_active: bool


class Teacher360ProfileResponse(BaseModel):
    basic_profile: Teacher360BasicProfile
    employment: Teacher360Employment | None
    account_linked: bool
    account_active: bool | None
    sections: list[Teacher360Section]
    timetable: list[Teacher360TimetableEntry]
    total_subject_assignments: int
    total_sections: int
    class_teacher_sections: int
    weekly_timetable_periods: int
    attendance_summary: Teacher360AttendanceSummary
    leave_summary: Teacher360LeaveSummary
    current_salary: Teacher360Salary | None
    recent_payroll: list[Teacher360PayrollSummary]
    recent_payments: list[Teacher360PaymentSummary]
    documents: list[Teacher360DocumentSummary]
