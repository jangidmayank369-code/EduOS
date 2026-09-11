from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FinalResult(Base):
    __tablename__ = "final_results"

    id: Mapped[int] = mapped_column(primary_key=True)

    configuration_id: Mapped[int] = mapped_column(
        ForeignKey("result_configurations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
        index=True,
    )

    total_marks: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    max_marks: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    percentage: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    grade: Mapped[str] = mapped_column(
        String(10),
        default="F",
        nullable=False,
    )

    rank: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    is_pass: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_locked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    published_at: Mapped[datetime | None] = mapped_column(
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

    configuration = relationship(
        "ResultConfiguration",
        back_populates="final_results",
    )

    student = relationship("Student")

    subjects = relationship(
        "FinalResultSubject",
        back_populates="final_result",
        cascade="all, delete-orphan",
    )


class FinalResultSubject(Base):
    __tablename__ = "final_result_subjects"

    id: Mapped[int] = mapped_column(primary_key=True)

    final_result_id: Mapped[int] = mapped_column(
        ForeignKey("final_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        nullable=False,
        index=True,
    )

    total_marks: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    max_marks: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    percentage: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    grade: Mapped[str] = mapped_column(
        String(10),
        default="F",
        nullable=False,
    )

    is_pass: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    final_result = relationship(
        "FinalResult",
        back_populates="subjects",
    )

    subject = relationship("Subject")