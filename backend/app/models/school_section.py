from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SchoolSection(Base):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(primary_key=True)

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    class_teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("teachers.id"),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
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

    school_class = relationship("SchoolClass")
    class_teacher = relationship("Teacher")
