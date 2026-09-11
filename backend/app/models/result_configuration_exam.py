from datetime import datetime

from sqlalchemy import Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ResultConfigurationExam(Base):
    __tablename__ = "result_configuration_exams"

    __table_args__ = (
        UniqueConstraint(
            "configuration_id",
            "exam_id",
            name="uq_result_configuration_exam",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    configuration_id: Mapped[int] = mapped_column(
        ForeignKey("result_configurations.id", ondelete="CASCADE"),
        nullable=False,
    )

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id"),
        nullable=False,
    )

    weightage: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    include_in_result: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False,
    )

    configuration = relationship(
        "ResultConfiguration",
        back_populates="exams",
    )

    exam = relationship(
        "Exam",
    )