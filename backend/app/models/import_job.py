from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)

    module: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
    )

    total_rows: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    successful_rows: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    failed_rows: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    error_details: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    uploaded_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    uploaded_by = relationship("User")