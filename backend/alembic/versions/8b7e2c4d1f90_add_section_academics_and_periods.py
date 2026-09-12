"""add section academics and timetable periods

Revision ID: 8b7e2c4d1f90
Revises: 7a4c9e2d6f11
Create Date: 2026-09-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8b7e2c4d1f90"
down_revision: Union[str, Sequence[str], None] = "7a4c9e2d6f11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------
    # Section Subject Teachers
    # ------------------------------------------------------------

    op.create_table(
        "section_subject_teachers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["section_id"],
            ["sections.id"],
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
        ),
        sa.ForeignKeyConstraint(
            ["teacher_id"],
            ["teachers.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "section_id",
            "subject_id",
            name="uq_section_subject_teacher_subject",
        ),
    )

    op.create_index(
        "ix_section_subject_teachers_section_id",
        "section_subject_teachers",
        ["section_id"],
        unique=False,
    )

    op.create_index(
        "ix_section_subject_teachers_subject_id",
        "section_subject_teachers",
        ["subject_id"],
        unique=False,
    )

    op.create_index(
        "ix_section_subject_teachers_teacher_id",
        "section_subject_teachers",
        ["teacher_id"],
        unique=False,
    )

    # ------------------------------------------------------------
    # Timetable Period Master
    # ------------------------------------------------------------

    op.create_table(
        "timetable_periods",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("period_number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column(
            "is_break",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "period_number",
            name="uq_timetable_period_number",
        ),
    )

    # ------------------------------------------------------------
    # Section Timetable
    # ------------------------------------------------------------

    op.create_table(
        "section_timetables",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("period_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("teacher_id", sa.Integer(), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("room_number", sa.String(length=50), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["section_id"],
            ["sections.id"],
        ),
        sa.ForeignKeyConstraint(
            ["period_id"],
            ["timetable_periods.id"],
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
        ),
        sa.ForeignKeyConstraint(
            ["teacher_id"],
            ["teachers.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "section_id",
            "day_of_week",
            "period_id",
            name="uq_section_timetable_period",
        ),
    )

    op.create_index(
        "ix_section_timetables_section_id",
        "section_timetables",
        ["section_id"],
        unique=False,
    )

    op.create_index(
        "ix_section_timetables_period_id",
        "section_timetables",
        ["period_id"],
        unique=False,
    )

    op.create_index(
        "ix_section_timetables_subject_id",
        "section_timetables",
        ["subject_id"],
        unique=False,
    )

    op.create_index(
        "ix_section_timetables_teacher_id",
        "section_timetables",
        ["teacher_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_section_timetables_teacher_id",
        table_name="section_timetables",
    )

    op.drop_index(
        "ix_section_timetables_subject_id",
        table_name="section_timetables",
    )

    op.drop_index(
        "ix_section_timetables_period_id",
        table_name="section_timetables",
    )

    op.drop_index(
        "ix_section_timetables_section_id",
        table_name="section_timetables",
    )

    op.drop_table("section_timetables")

    op.drop_table("timetable_periods")

    op.drop_index(
        "ix_section_subject_teachers_teacher_id",
        table_name="section_subject_teachers",
    )

    op.drop_index(
        "ix_section_subject_teachers_subject_id",
        table_name="section_subject_teachers",
    )

    op.drop_index(
        "ix_section_subject_teachers_section_id",
        table_name="section_subject_teachers",
    )

    op.drop_table("section_subject_teachers")