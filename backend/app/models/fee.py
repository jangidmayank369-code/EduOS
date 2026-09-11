from datetime import datetime

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Fee(Base):
    __tablename__ = "fees"

    id: Mapped[int] = mapped_column(primary_key=True)

    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False
    )

    # Links this fee to the fee structure that generated it.
    # Nullable so all existing fee records remain valid.
    fee_structure_id: Mapped[int | None] = mapped_column(
        ForeignKey("fee_structures.id"),
        nullable=True,
        index=True
    )

    # Academic session for which this fee belongs.
    # Nullable so existing fee records remain valid.
    academic_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("academic_sessions.id"),
        nullable=True,
        index=True
    )

    title: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    amount_due: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    amount_paid: Mapped[float] = mapped_column(
        Float,
        default=0,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    student = relationship("Student")

    fee_structure = relationship("FeeStructure")

    academic_session = relationship("AcademicSession")