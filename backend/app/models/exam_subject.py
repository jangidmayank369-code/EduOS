from typing import Any

from sqlalchemy import Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ExamSubject(Base):
    """
    Configuration of a subject inside a particular examination and class.

    This model stores:
        - total maximum marks
        - total pass marks
        - optional/result inclusion flags
        - configurable exam components

    Example component configuration:

    [
        {
            "key": "written",
            "name": "Written",
            "type": "THEORY",
            "max_marks": 70,
            "pass_marks": 28,
            "include_in_result": true,
            "is_optional": false,
            "display_order": 1
        },
        {
            "key": "oral",
            "name": "Oral",
            "type": "ORAL",
            "max_marks": 30,
            "pass_marks": 12,
            "include_in_result": true,
            "is_optional": false,
            "display_order": 2
        }
    ]

    The component structure is intentionally JSON-based at this stage so
    the existing ExamSubject API/frontend contract remains compatible.

    Component-level marks storage/calculation belongs to the Marks Entry
    and Final Result layers and should not be hard-coded here.
    """

    __tablename__ = "exam_subjects"

    # -----------------------------------------------------
    # Primary Keys
    # -----------------------------------------------------

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id"),
        primary_key=True,
    )

    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id"),
        primary_key=True,
    )

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id"),
        primary_key=True,
    )

    # -----------------------------------------------------
    # Total Marks Configuration
    # -----------------------------------------------------

    max_marks: Mapped[float] = mapped_column(
        Float,
        default=100.0,
        nullable=False,
    )

    pass_marks: Mapped[float] = mapped_column(
        Float,
        default=40.0,
        nullable=False,
    )

    # -----------------------------------------------------
    # Component Configuration
    # -----------------------------------------------------
    #
    # Example:
    #
    # [
    #     {
    #         "key": "written",
    #         "name": "Written",
    #         "type": "THEORY",
    #         "max_marks": 70,
    #         "pass_marks": 28,
    #         "include_in_result": true,
    #         "is_optional": false,
    #         "display_order": 1
    #     },
    #     {
    #         "key": "oral",
    #         "name": "Oral",
    #         "type": "ORAL",
    #         "max_marks": 30,
    #         "pass_marks": 12,
    #         "include_in_result": true,
    #         "is_optional": false,
    #         "display_order": 2
    #     }
    # ]
    #
    # Supported component types are configuration values, not database
    # enums, so future schools can add their own component types without
    # requiring a database migration.
    # -----------------------------------------------------

    components: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )

    # -----------------------------------------------------
    # Result Configuration
    # -----------------------------------------------------

    is_optional: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    include_in_result: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    # -----------------------------------------------------
    # Relationships
    # -----------------------------------------------------

    exam = relationship(
        "Exam",
        back_populates="exam_subjects",
    )

    school_class = relationship(
        "SchoolClass",
    )

    subject = relationship(
        "Subject",
    )