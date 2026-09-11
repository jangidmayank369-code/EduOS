"""create exam schedules

Revision ID: 8f31a6c2d901
Revises: 467c19e3beb2
Create Date: 2026-09-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8f31a6c2d901"
down_revision: Union[str, Sequence[str], None] = "467c19e3beb2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exam_schedules",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "exam_id",
            sa.Integer(),
            sa.ForeignKey(
                "exams.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "class_id",
            sa.Integer(),
            sa.ForeignKey("classes.id"),
            nullable=False,
        ),

        sa.Column(
            "subject_id",
            sa.Integer(),
            sa.ForeignKey("subjects.id"),
            nullable=False,
        ),

        sa.Column(
            "exam_date",
            sa.Date(),
            nullable=False,
        ),

        sa.Column(
            "shift",
            sa.String(length=20),
            server_default="MORNING",
            nullable=False,
        ),

        sa.Column(
            "start_time",
            sa.Time(),
            nullable=False,
        ),

        sa.Column(
            "end_time",
            sa.Time(),
            nullable=False,
        ),

        sa.Column(
            "room",
            sa.String(length=100),
            nullable=True,
        ),

        sa.Column(
            "instructions",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),

        sa.UniqueConstraint(
            "exam_id",
            "class_id",
            "subject_id",
            name="uq_exam_schedule_exam_class_subject",
        ),
    )

    op.create_index(
        "ix_exam_schedules_exam_id",
        "exam_schedules",
        ["exam_id"],
    )

    op.create_index(
        "ix_exam_schedules_class_id",
        "exam_schedules",
        ["class_id"],
    )

    op.create_index(
        "ix_exam_schedules_subject_id",
        "exam_schedules",
        ["subject_id"],
    )

    op.create_index(
        "ix_exam_schedules_exam_date",
        "exam_schedules",
        ["exam_date"],
    )

    op.create_index(
        "ix_exam_schedules_class_date",
        "exam_schedules",
        ["class_id", "exam_date"],
    )

    op.create_index(
        "ix_exam_schedules_date_room",
        "exam_schedules",
        ["exam_date", "room"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_exam_schedules_date_room",
        table_name="exam_schedules",
    )

    op.drop_index(
        "ix_exam_schedules_class_date",
        table_name="exam_schedules",
    )

    op.drop_index(
        "ix_exam_schedules_exam_date",
        table_name="exam_schedules",
    )

    op.drop_index(
        "ix_exam_schedules_subject_id",
        table_name="exam_schedules",
    )

    op.drop_index(
        "ix_exam_schedules_class_id",
        table_name="exam_schedules",
    )

    op.drop_index(
        "ix_exam_schedules_exam_id",
        table_name="exam_schedules",
    )

    op.drop_table("exam_schedules")