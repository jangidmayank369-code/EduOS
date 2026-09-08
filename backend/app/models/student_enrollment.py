from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "academic_session_id",
            name="uq_student_academic_session",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
    )

    academic_session_id: Mapped[int] = mapped_column(
        ForeignKey("academic_sessions.id"),
        nullable=False,
    )

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        nullable=False,
    )

    admission_application_id: Mapped[int | None] = mapped_column(
        ForeignKey("admission_applications.id"),
        nullable=True,
    )

    roll_number: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    enrollment_date: Mapped[date] = mapped_column(
        Date,
        default=date.today,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="ACTIVE",
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        String(500),
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

    student = relationship("Student")

    academic_session = relationship("AcademicSession")

    school_class = relationship("SchoolClass")

    admission_application = relationship(
        "AdmissionApplication",
    )