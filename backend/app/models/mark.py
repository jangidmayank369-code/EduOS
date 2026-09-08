from datetime import datetime

from sqlalchemy import Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Mark(Base):
    __tablename__ = "marks"
    __table_args__ = (
    UniqueConstraint(
        "student_id",
        "exam_id",
        "subject_id",
        name="uq_mark_student_exam_subject"
    ),
)

    id: Mapped[int] = mapped_column(primary_key=True)

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False
    )

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id"),
        nullable=False
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        nullable=False
    )

    marks_obtained: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    max_marks: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    entered_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    student = relationship("Student")
    exam = relationship("Exam")
    subject = relationship("Subject")
    user = relationship("User")