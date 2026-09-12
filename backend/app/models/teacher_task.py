from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TeacherTask(Base):
    __tablename__ = "teacher_tasks"
    __table_args__ = (
        UniqueConstraint(
            "teacher_id",
            "title",
            "due_date",
            name="uq_teacher_task_teacher_title_due_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    assigned_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    task_type: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="GENERAL",
    )

    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="MEDIUM",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ASSIGNED",
        index=True,
    )

    progress_percent: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    due_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    teacher_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    admin_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    teacher = relationship("Teacher")
    assigned_by = relationship(
        "User",
        foreign_keys=[assigned_by_user_id],
    )
    reviewed_by = relationship(
        "User",
        foreign_keys=[reviewed_by_user_id],
    )
