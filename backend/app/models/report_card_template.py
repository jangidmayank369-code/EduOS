from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReportCardTemplate(Base):
    __tablename__ = "report_card_templates"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("classes.id"),
        nullable=True,
    )

    academic_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("academic_sessions.id"),
        nullable=True,
    )

    exam_id: Mapped[int | None] = mapped_column(
        ForeignKey("exams.id"),
        nullable=True,
    )

    page_size: Mapped[str] = mapped_column(
        String(20),
        default="A4",
        nullable=False,
    )

    orientation: Mapped[str] = mapped_column(
        String(20),
        default="portrait",
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="DRAFT",
        nullable=False,
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    elements: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )

    settings: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
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
        foreign_keys=[class_id],
    )

    academic_session = relationship(
        "AcademicSession",
        foreign_keys=[academic_session_id],
    )

    exam = relationship(
        "Exam",
        foreign_keys=[exam_id],
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
    )