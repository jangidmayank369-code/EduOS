from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("teachers.id"),
        primary_key=True
    )

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        primary_key=True
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        primary_key=True
    )

    teacher = relationship("Teacher")
    school_class = relationship("SchoolClass")
    subject = relationship("Subject")