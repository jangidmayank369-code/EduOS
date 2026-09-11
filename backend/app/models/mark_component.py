from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MarkComponent(Base):
    """Stores one assessment component of a subject mark.

    One legacy ``marks`` row represents the complete subject/exam mark.
    This table stores the independent WPS components (Written, Oral,
    Practical, Other, etc.) without breaking existing marks data.
    """

    __tablename__ = "mark_components"
    __table_args__ = (
        UniqueConstraint(
            "mark_id",
            "component_key",
            name="uq_mark_component_mark_key",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    mark_id: Mapped[int] = mapped_column(
        ForeignKey("marks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    component_key: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    component_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    component_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="OTHER",
        server_default="OTHER",
    )

    marks_obtained: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    max_marks: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    pass_marks: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0",
    )

    entered_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )