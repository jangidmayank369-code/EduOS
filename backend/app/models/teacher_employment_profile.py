from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TeacherEmploymentProfile(Base):
    """
    HR/employment layer for a teacher.

    The existing Teacher table remains the core identity record.
    This one-to-one profile stores employment-specific information so
    future payroll, leave, attendance and teacher-portal features can
    build on a stable HR record without repeatedly changing Teacher.
    """

    __tablename__ = "teacher_employment_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    designation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    employment_type: Mapped[str] = mapped_column(
        String(50),
        default="FULL_TIME",
        nullable=False,
    )

    employment_status: Mapped[str] = mapped_column(
        String(50),
        default="ACTIVE",
        nullable=False,
    )

    joining_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    confirmation_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    resignation_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    last_working_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    qualification: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    specialization: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    experience_years: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    teacher = relationship("Teacher")
