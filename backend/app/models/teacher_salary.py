from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TeacherSalaryStructure(Base):
    __tablename__ = "teacher_salary_structures"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "effective_from",
            name="uq_teacher_salary_structure_teacher_effective_from",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    effective_from: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    basic_salary: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    allowances: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    deductions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    payroll_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="MONTHLY",
    )
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    teacher = relationship("Teacher")


class TeacherPayroll(Base):
    __tablename__ = "teacher_payrolls"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "payroll_year",
            "payroll_month",
            name="uq_teacher_payroll_teacher_year_month",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    salary_structure_id: Mapped[int | None] = mapped_column(
        ForeignKey("teacher_salary_structures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    payroll_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    payroll_month: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    basic_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    allowances_snapshot: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )
    deductions_snapshot: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )
    gross_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="DRAFT",
        index=True,
    )
    processed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    processed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    teacher = relationship("Teacher")
    salary_structure = relationship("TeacherSalaryStructure")
    processed_by = relationship("User")
    payslip = relationship(
        "TeacherPayslip",
        back_populates="payroll",
        uselist=False,
        cascade="all, delete-orphan",
    )
    payments = relationship(
        "TeacherPayment",
        back_populates="payroll",
        cascade="all, delete-orphan",
    )


class TeacherPayslip(Base):
    __tablename__ = "teacher_payslips"

    id: Mapped[int] = mapped_column(primary_key=True)
    payroll_id: Mapped[int] = mapped_column(
        ForeignKey("teacher_payrolls.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    payslip_number: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        unique=True,
        index=True,
    )
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    earnings_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    deductions_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ISSUED",
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    payroll = relationship("TeacherPayroll", back_populates="payslip")


class TeacherPayment(Base):
    __tablename__ = "teacher_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    payroll_id: Mapped[int] = mapped_column(
        ForeignKey("teacher_payrolls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="BANK_TRANSFER",
    )
    transaction_reference: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="COMPLETED",
        index=True,
    )
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    payroll = relationship("TeacherPayroll", back_populates="payments")
    created_by = relationship("User")
