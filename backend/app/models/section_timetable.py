from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SectionTimetable(Base):
    __tablename__ = "section_timetables"

    __table_args__ = (
        UniqueConstraint(
            "section_id",
            "day_of_week",
            "period_id",
            name="uq_section_timetable_period",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id"),
        nullable=False,
        index=True,
    )

    period_id: Mapped[int] = mapped_column(
        ForeignKey("timetable_periods.id"),
        nullable=False,
        index=True,
    )

    subject_id: Mapped[int | None] = mapped_column(
        ForeignKey("subjects.id"),
        nullable=True,
        index=True,
    )

    teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("teachers.id"),
        nullable=True,
        index=True,
    )

    day_of_week: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    room_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    section = relationship("SchoolSection")
    period = relationship("TimetablePeriod")
    subject = relationship("Subject")
    teacher = relationship("Teacher")