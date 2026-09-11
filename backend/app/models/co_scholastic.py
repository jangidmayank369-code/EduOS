from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CoScholasticComponent(Base):
    """
    Class-wise co-scholastic component configuration.

    Examples:
    - Social Service
    - Physical & Health Education
    - Art Education
    - General Knowledge
    """

    __tablename__ = "co_scholastic_components"

    id: Mapped[int] = mapped_column(primary_key=True)

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    component_type: Mapped[str] = mapped_column(
        String(20),
        default="GRADE",
        nullable=False,
    )

    max_marks: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    include_in_result: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    display_order: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
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

    school_class = relationship(
        "SchoolClass",
    )

    entries = relationship(
        "CoScholasticEntry",
        back_populates="component",
        cascade="all, delete-orphan",
    )


class CoScholasticEntry(Base):
    """
    Student-wise co-scholastic assessment entry.
    """

    __tablename__ = "co_scholastic_entries"

    __table_args__ = (
        UniqueConstraint(
            "component_id",
            "student_id",
            name="uq_co_scholastic_component_student",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    component_id: Mapped[int] = mapped_column(
        ForeignKey("co_scholastic_components.id"),
        nullable=False,
    )

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
    )

    marks: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    grade: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    remark: Mapped[str | None] = mapped_column(
        Text,
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

    component = relationship(
        "CoScholasticComponent",
        back_populates="entries",
    )

    student = relationship(
        "Student",
    )