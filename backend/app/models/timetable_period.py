from datetime import datetime, time

from sqlalchemy import Boolean, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TimetablePeriod(Base):
    __tablename__ = "timetable_periods"

    id: Mapped[int] = mapped_column(primary_key=True)

    period_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        unique=True,
    )

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    start_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    end_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )

    is_break: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
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