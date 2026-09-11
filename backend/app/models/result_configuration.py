from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ResultConfiguration(Base):
    __tablename__ = "result_configurations"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        nullable=False,
        index=True,
    )

    academic_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("academic_sessions.id"),
        nullable=True,
        index=True,
    )

    term: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    calculation_method: Mapped[str] = mapped_column(
        String(30),
        default="WEIGHTED",
        nullable=False,
    )

    best_of_count: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="DRAFT",
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
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

    school_class = relationship("SchoolClass")

    academic_session = relationship("AcademicSession")

    exams = relationship(
        "ResultConfigurationExam",
        back_populates="configuration",
        cascade="all, delete-orphan",
    )

    final_results = relationship(
        "FinalResult",
        back_populates="configuration",
        cascade="all, delete-orphan",
    )


class ResultConfigurationExam(Base):
    __tablename__ = "result_configuration_exams"

    id: Mapped[int] = mapped_column(primary_key=True)

    configuration_id: Mapped[int] = mapped_column(
        ForeignKey("result_configurations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id"),
        nullable=False,
        index=True,
    )

    weightage: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False,
    )

    include_in_result: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    configuration = relationship(
        "ResultConfiguration",
        back_populates="exams",
    )

    exam = relationship("Exam")

    __table_args__ = (
        UniqueConstraint(
            "configuration_id",
            "exam_id",
            name="uq_result_config_exam",
        ),
    )