from datetime import datetime
from typing import Any

from sqlalchemy import Float, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Mark(Base):
    """
    Student marks for one exam + subject.

    The main marks_obtained/max_marks fields preserve the existing
    subject-level result structure.

    component_marks stores configurable component-wise marks, for example:

    {
        "written": {
            "name": "Written",
            "type": "THEORY",
            "marks_obtained": 62,
            "max_marks": 70
        },
        "oral": {
            "name": "Oral",
            "type": "ORAL",
            "marks_obtained": 26,
            "max_marks": 30
        }
    }

    This allows the ExamSubject configuration to define components such as:

    - Written
    - Oral
    - Theory
    - Practical
    - Internal
    - Project

    without hard-coding the component structure in the Mark model.
    """

    __tablename__ = "marks"

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "exam_id",
            "subject_id",
            name="uq_mark_student_exam_subject",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
        index=True,
    )

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id"),
        nullable=False,
        index=True,
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        nullable=False,
        index=True,
    )

    # ---------------------------------------------------------------
    # Subject-level total
    # ---------------------------------------------------------------

    marks_obtained: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    max_marks: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # ---------------------------------------------------------------
    # Component-level marks
    # ---------------------------------------------------------------

    component_marks: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )

    # ---------------------------------------------------------------
    # Mark status
    # ---------------------------------------------------------------

    status: Mapped[str] = mapped_column(
        String(30),
        default="PRESENT",
        nullable=False,
    )

    # ---------------------------------------------------------------
    # Audit
    # ---------------------------------------------------------------

    entered_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
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

    # ---------------------------------------------------------------
    # Relationships
    # ---------------------------------------------------------------

    student = relationship("Student")

    exam = relationship("Exam")

    subject = relationship("Subject")

    user = relationship("User")