from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SectionSubjectTeacher(Base):
    __tablename__ = "section_subject_teachers"
    __table_args__ = (
        UniqueConstraint(
            "section_id",
            "subject_id",
            name="uq_section_subject_teacher_subject",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"), nullable=False, index=True
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    section = relationship("SchoolSection")
    subject = relationship("Subject")
    teacher = relationship("Teacher")