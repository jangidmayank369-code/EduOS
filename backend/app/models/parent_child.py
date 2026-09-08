from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ParentChild(Base):
    __tablename__ = "parent_children"

    parent_id: Mapped[int] = mapped_column(
        ForeignKey("parents.id"),
        primary_key=True,
    )

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        primary_key=True,
    )

    relation_type: Mapped[str] = mapped_column(
        String(30),
        default="GUARDIAN",
        nullable=False,
    )

    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_emergency_contact: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    receives_notifications: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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

    parent = relationship(
        "Parent",
        back_populates="children",
    )

    student = relationship(
        "Student",
        back_populates="parents",
    )