from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StudentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    TRANSFERRED = "TRANSFERRED"
    WITHDRAWN = "WITHDRAWN"
    PASSED_OUT = "PASSED_OUT"
    ALUMNI = "ALUMNI"


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)

    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id"),
        nullable=True,
    )

    school_class = relationship("SchoolClass")

    admission_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    gender: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    status: Mapped[StudentStatus] = mapped_column(
        String(20),
        default=StudentStatus.ACTIVE,
        nullable=False,
    )

    status_changed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    status_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    status_history = relationship(
        "StudentStatusHistory",
        back_populates="student",
        cascade="all, delete-orphan",
        order_by="StudentStatusHistory.changed_at.desc()",
    )

    parents = relationship(
        "ParentChild",
        back_populates="student",
        cascade="all, delete-orphan",
    )