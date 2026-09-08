from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ParentChild(Base):
    __tablename__ = "parent_children"
    parent_id: Mapped[int] = mapped_column(
        ForeignKey("parents.id"),
        primary_key=True
    )

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        primary_key=True
    )

    parent = relationship("Parent")
    student = relationship("Student")