from datetime import datetime
from typing import Final

from sqlalchemy import Date, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Exam(Base):
    """
    Master record for an academic examination.

    The Exam model defines the examination itself.

    Subject-level configuration such as:
        - maximum marks
        - pass marks
        - written/practical/oral/internal components
        - optional subjects
        - inclusion in result

    belongs to ExamSubject / exam-component configuration and should
    not be hard-coded here.

    Result calculation rules belong to the final-result configuration
    layer, not to this model.
    """

    __tablename__ = "exams"

    # ------------------------------------------------------------------
    # Supported exam types
    # ------------------------------------------------------------------

    CLASS_TEST: Final[str] = "CLASS_TEST"
    UNIT_TEST: Final[str] = "UNIT_TEST"
    PERIODIC_TEST: Final[str] = "PERIODIC_TEST"
    MONTHLY_TEST: Final[str] = "MONTHLY_TEST"
    HALF_YEARLY: Final[str] = "HALF_YEARLY"
    ANNUAL: Final[str] = "ANNUAL"
    PRE_BOARD: Final[str] = "PRE_BOARD"
    PRACTICAL: Final[str] = "PRACTICAL"
    OTHER: Final[str] = "OTHER"

    EXAM_TYPES: Final[tuple[str, ...]] = (
        CLASS_TEST,
        UNIT_TEST,
        PERIODIC_TEST,
        MONTHLY_TEST,
        HALF_YEARLY,
        ANNUAL,
        PRE_BOARD,
        PRACTICAL,
        OTHER,
    )

    # ------------------------------------------------------------------
    # Exam lifecycle
    # ------------------------------------------------------------------

    DRAFT: Final[str] = "DRAFT"
    ACTIVE: Final[str] = "ACTIVE"
    LOCKED: Final[str] = "LOCKED"
    PUBLISHED: Final[str] = "PUBLISHED"

    STATUSES: Final[tuple[str, ...]] = (
        DRAFT,
        ACTIVE,
        LOCKED,
        PUBLISHED,
    )

    # ------------------------------------------------------------------
    # Primary key
    # ------------------------------------------------------------------

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    # ------------------------------------------------------------------
    # Basic information
    # ------------------------------------------------------------------

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Examination classification
    # ------------------------------------------------------------------

    exam_type: Mapped[str] = mapped_column(
        String(30),
        default=OTHER,
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Academic period
    #
    # Keep academic_year for compatibility with the current schema/API.
    # Academic-session FK integration should be handled after auditing
    # the existing AcademicSession model and migrations.
    # ------------------------------------------------------------------

    academic_year: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    term: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Examination dates
    # ------------------------------------------------------------------

    start_date: Mapped[datetime | None] = mapped_column(
        Date,
        nullable=True,
    )

    end_date: Mapped[datetime | None] = mapped_column(
        Date,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Final-result participation
    #
    # Example:
    #
    # Periodic Test 1 -> True
    # Half Yearly     -> True
    # Practice Exam   -> False
    #
    # The actual calculation method/percentage belongs to the
    # final-result configuration.
    # ------------------------------------------------------------------

    include_in_result: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    weightage: Mapped[float] = mapped_column(
        default=0.0,
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Workflow state
    #
    # DRAFT
    #   Configuration is being prepared.
    #
    # ACTIVE
    #   Marks can be entered/updated according to API rules.
    #
    # LOCKED
    #   Marks/result data must not be modified through normal marks
    #   entry operations.
    #
    # PUBLISHED
    #   Result is officially released for report-card/result viewing.
    # ------------------------------------------------------------------

    status: Mapped[str] = mapped_column(
        String(20),
        default=DRAFT,
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Soft-active flag
    #
    # This is intentionally separate from workflow status.
    #
    # Example:
    # status = DRAFT
    # is_active = False
    #
    # means the exam record exists but is currently disabled.
    # ------------------------------------------------------------------

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Audit timestamps
    # ------------------------------------------------------------------

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    exam_subjects = relationship(
        "ExamSubject",
        back_populates="exam",
        cascade="all, delete-orphan",
    )

    exam_schedules = relationship(
        "ExamSchedule",
        back_populates="exam",
        cascade="all, delete-orphan",
    )