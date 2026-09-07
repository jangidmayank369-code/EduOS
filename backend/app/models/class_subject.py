from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ClassSubject(Base):
    __tablename__ = "class_subjects"

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        primary_key=True
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        primary_key=True
    )
    school_class = relationship(
    "SchoolClass",
    back_populates="subjects"
    )
    subject = relationship(
    "Subject",
    back_populates="classes"
    )