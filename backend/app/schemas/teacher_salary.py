from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TeacherSalaryStructureCreate(BaseModel):
    effective_from: date
    effective_to: date | None = None
    basic_salary: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    allowances: dict[str, Decimal] = Field(default_factory=dict)
    deductions: dict[str, Decimal] = Field(default_factory=dict)
    payroll_type: str = Field(default="MONTHLY", min_length=2, max_length=30)
    is_active: bool = True
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.effective_to is not None and self.effective_to < self.effective_from:
            raise ValueError("effective_to cannot be before effective_from")
        return self


class TeacherSalaryStructureUpdate(BaseModel):
    effective_from: date | None = None
    effective_to: date | None = None
    basic_salary: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    allowances: dict[str, Decimal] | None = None
    deductions: dict[str, Decimal] | None = None
    payroll_type: str | None = Field(default=None, min_length=2, max_length=30)
    is_active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class TeacherSalaryStructureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    effective_from: date
    effective_to: date | None
    basic_salary: Decimal
    allowances: dict
    deductions: dict
    payroll_type: str
    is_active: bool
    notes: str | None


class TeacherPayrollGenerate(BaseModel):
    payroll_year: int = Field(ge=2000, le=2100)
    payroll_month: int = Field(ge=1, le=12)
    notes: str | None = Field(default=None, max_length=2000)


class TeacherPayrollUpdate(BaseModel):
    status: str | None = Field(default=None, min_length=2, max_length=30)
    notes: str | None = Field(default=None, max_length=2000)


class TeacherPayrollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    salary_structure_id: int | None
    payroll_year: int
    payroll_month: int
    basic_salary: Decimal
    allowances_snapshot: dict
    deductions_snapshot: dict
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: str
    processed_by_user_id: int | None
    processed_at: object | None
    notes: str | None


class TeacherPayslipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payroll_id: int
    payslip_number: str
    issue_date: date
    earnings_snapshot: dict
    deductions_snapshot: dict
    net_salary: Decimal
    status: str
    notes: str | None


class TeacherPaymentCreate(BaseModel):
    payment_date: date
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    payment_method: str = Field(default="BANK_TRANSFER", min_length=2, max_length=30)
    transaction_reference: str | None = Field(default=None, max_length=120)
    status: str = Field(default="COMPLETED", min_length=2, max_length=30)
    remarks: str | None = Field(default=None, max_length=2000)


class TeacherPaymentUpdate(BaseModel):
    payment_date: date | None = None
    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    payment_method: str | None = Field(default=None, min_length=2, max_length=30)
    transaction_reference: str | None = Field(default=None, max_length=120)
    status: str | None = Field(default=None, min_length=2, max_length=30)
    remarks: str | None = Field(default=None, max_length=2000)


class TeacherPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payroll_id: int
    payment_date: date
    amount: Decimal
    payment_method: str
    transaction_reference: str | None
    status: str
    remarks: str | None
    created_by_user_id: int | None
