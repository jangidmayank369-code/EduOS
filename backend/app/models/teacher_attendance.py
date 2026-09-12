from datetime import date, datetime, time

from sqlalchemy import Date, ForeignKey, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TeacherAttendance(Base):
    __tablename__ = "teacher_attendance"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "attendance_date",
            name="uq_teacher_attendance_teacher_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    attendance_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PRESENT",
    )

    check_in: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    check_out: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    leave_id: Mapped[int | None] = mapped_column(
        ForeignKey("teacher_leaves.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
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

    teacher = relationship("Teacher")
    leave = relationship("TeacherLeave")
