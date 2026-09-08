from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AdmissionApplication(Base):
    __tablename__ = "admission_applications"

    id: Mapped[int] = mapped_column(primary_key=True)

    application_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    academic_session_id: Mapped[int] = mapped_column(
        ForeignKey("academic_sessions.id"),
        nullable=False,
    )

    applying_class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id"),
        nullable=True,
    )

    # Student created after successful admission conversion.
    student_id: Mapped[int | None] = mapped_column(
        ForeignKey("students.id"),
        nullable=True,
        unique=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    parent_first_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    parent_last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    parent_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    parent_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    parent_relation: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    previous_school_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    previous_class: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    previous_school_result: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="APPLIED",
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    academic_session = relationship(
        "AcademicSession",
    )

    applying_class = relationship(
        "SchoolClass",
    )

    student = relationship(
        "Student",
    )

    reviewed_by = relationship(
        "User",
    )