"""enhance exam and exam subject

Revision ID: 467c19e3beb2
Revises: 7f3a9c2d1e44
Create Date: 2026-09-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "467c19e3beb2"
down_revision: Union[str, Sequence[str], None] = "7f3a9c2d1e44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------------------------------------------------------
    # EXAM SUBJECTS
    # ---------------------------------------------------------

    # Existing rows already exist in exam_subjects.
    # Therefore add these columns with temporary server defaults
    # so PostgreSQL can populate existing rows safely.

    op.add_column(
        "exam_subjects",
        sa.Column(
            "max_marks",
            sa.Float(),
            nullable=False,
            server_default=sa.text("100"),
        ),
    )

    op.add_column(
        "exam_subjects",
        sa.Column(
            "pass_marks",
            sa.Float(),
            nullable=False,
            server_default=sa.text("40"),
        ),
    )

    op.add_column(
        "exam_subjects",
        sa.Column(
            "is_optional",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.add_column(
        "exam_subjects",
        sa.Column(
            "include_in_result",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # ---------------------------------------------------------
    # COMPONENT CONFIGURATION
    # ---------------------------------------------------------

    # Stores configurable components such as:
    #
    # [
    #   {
    #       "key": "written",
    #       "name": "Written",
    #       "type": "THEORY",
    #       "max_marks": 70,
    #       "pass_marks": 28,
    #       "include_in_result": true,
    #       "is_optional": false,
    #       "display_order": 1
    #   },
    #   {
    #       "key": "oral",
    #       "name": "Oral",
    #       "type": "ORAL",
    #       "max_marks": 30,
    #       "pass_marks": 12,
    #       "include_in_result": true,
    #       "is_optional": false,
    #       "display_order": 2
    #   }
    # ]
    #
    # Existing exam subjects get an empty component list.

    op.add_column(
        "exam_subjects",
        sa.Column(
            "components",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )

    # Remove database-level temporary defaults.
    # Model defaults will handle new application-created records.

    op.alter_column(
        "exam_subjects",
        "max_marks",
        server_default=None,
    )

    op.alter_column(
        "exam_subjects",
        "pass_marks",
        server_default=None,
    )

    op.alter_column(
        "exam_subjects",
        "is_optional",
        server_default=None,
    )

    op.alter_column(
        "exam_subjects",
        "include_in_result",
        server_default=None,
    )

    op.alter_column(
        "exam_subjects",
        "components",
        server_default=None,
    )

    # ---------------------------------------------------------
    # EXAMS
    # ---------------------------------------------------------

    op.add_column(
        "exams",
        sa.Column(
            "exam_type",
            sa.String(length=30),
            nullable=False,
            server_default=sa.text("'EXAM'"),
        ),
    )

    op.add_column(
        "exams",
        sa.Column(
            "academic_year",
            sa.String(length=20),
            nullable=True,
        ),
    )

    op.add_column(
        "exams",
        sa.Column(
            "term",
            sa.String(length=30),
            nullable=True,
        ),
    )

    op.add_column(
        "exams",
        sa.Column(
            "start_date",
            sa.Date(),
            nullable=True,
        ),
    )

    op.add_column(
        "exams",
        sa.Column(
            "end_date",
            sa.Date(),
            nullable=True,
        ),
    )

    op.add_column(
        "exams",
        sa.Column(
            "include_in_result",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.add_column(
        "exams",
        sa.Column(
            "weightage",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    op.add_column(
        "exams",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'DRAFT'"),
        ),
    )

    # Remove temporary database defaults.

    op.alter_column(
        "exams",
        "exam_type",
        server_default=None,
    )

    op.alter_column(
        "exams",
        "include_in_result",
        server_default=None,
    )

    op.alter_column(
        "exams",
        "weightage",
        server_default=None,
    )

    op.alter_column(
        "exams",
        "status",
        server_default=None,
    )

    # ---------------------------------------------------------
    # DESCRIPTION
    # ---------------------------------------------------------

    # Existing description column:
    # VARCHAR(255) -> TEXT

    op.alter_column(
        "exams",
        "description",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    # ---------------------------------------------------------
    # REVERT EXAMS
    # ---------------------------------------------------------

    op.alter_column(
        "exams",
        "description",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )

    op.drop_column("exams", "status")
    op.drop_column("exams", "weightage")
    op.drop_column("exams", "include_in_result")
    op.drop_column("exams", "end_date")
    op.drop_column("exams", "start_date")
    op.drop_column("exams", "term")
    op.drop_column("exams", "academic_year")
    op.drop_column("exams", "exam_type")

    # ---------------------------------------------------------
    # REVERT EXAM SUBJECTS
    # ---------------------------------------------------------

    op.drop_column("exam_subjects", "components")
    op.drop_column("exam_subjects", "include_in_result")
    op.drop_column("exam_subjects", "is_optional")
    op.drop_column("exam_subjects", "pass_marks")
    op.drop_column("exam_subjects", "max_marks")