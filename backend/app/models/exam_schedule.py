from datetime import date, datetime, time
from typing import Final

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ExamSchedule(Base):
    """
    Schedule entry for a subject within an examination.

    A schedule connects:

        Exam
            ↓
        Class
            ↓
        Subject
            ↓
        Date / Shift / Time / Room

    The actual marks configuration belongs to ExamSubject.
    This model is responsible only for examination scheduling.
    """

    __tablename__ = "exam_schedules"

    # -----------------------------------------------------
    # Supported Shift Values
    # -----------------------------------------------------

    MORNING: Final[str] = "MORNING"
    AFTERNOON: Final[str] = "AFTERNOON"
    EVENING: Final[str] = "EVENING"
    OTHER: Final[str] = "OTHER"

    SHIFTS: Final[tuple[str, ...]] = (
        MORNING,
        AFTERNOON,
        EVENING,
        OTHER,
    )

    # -----------------------------------------------------
    # Primary Key
    # -----------------------------------------------------

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    # -----------------------------------------------------
    # References
    # -----------------------------------------------------

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id"),
        nullable=False,
        index=True,
    )

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        nullable=False,
        index=True,
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------
    # Schedule Date
    # -----------------------------------------------------

    exam_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    # -----------------------------------------------------
    # Shift
    # -----------------------------------------------------

    shift: Mapped[str] = mapped_column(
        String(20),
        default=MORNING,
        nullable=False,
    )

    # -----------------------------------------------------
    # Examination Time
    # -----------------------------------------------------

    start_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    end_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    # -----------------------------------------------------
    # Location / Instructions
    # -----------------------------------------------------

    room: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # -----------------------------------------------------
    # Status
    # -----------------------------------------------------

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # -----------------------------------------------------
    # Audit Timestamps
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # Relationships
    # -----------------------------------------------------

    exam = relationship(
        "Exam",
        back_populates="exam_schedules",
    )

    school_class = relationship(
        "SchoolClass",
    )

    subject = relationship(
        "Subject",
    )