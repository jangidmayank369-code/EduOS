from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ExamSubject(Base):
    __tablename__ = "exam_subjects"

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id"),
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

    exam = relationship("Exam")
    school_class = relationship("SchoolClass")
    subject = relationship("Subject")