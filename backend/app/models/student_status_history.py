from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StudentStatusHistory(Base):
    __tablename__ = "student_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
    )

    old_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    new_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    changed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    changed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    student = relationship(
        "Student",
        back_populates="status_history",
    )

    changed_by = relationship(
        "User",
    )