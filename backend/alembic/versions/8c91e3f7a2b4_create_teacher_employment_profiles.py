"""create teacher employment profiles

Revision ID: 8c91e3f7a2b4
Revises: ef53a852aeab
Create Date: 2026-09-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c91e3f7a2b4"
down_revision: Union[str, Sequence[str], None] = "ef53a852aeab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "teacher_employment_profiles" in inspector.get_table_names():
        return

    op.create_table(
        "teacher_employment_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("designation", sa.String(length=100), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column(
            "employment_type",
            sa.String(length=50),
            nullable=False,
            server_default="FULL_TIME",
        ),
        sa.Column(
            "employment_status",
            sa.String(length=50),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column("joining_date", sa.Date(), nullable=True),
        sa.Column("confirmation_date", sa.Date(), nullable=True),
        sa.Column("resignation_date", sa.Date(), nullable=True),
        sa.Column("last_working_date", sa.Date(), nullable=True),
        sa.Column("qualification", sa.String(length=500), nullable=True),
        sa.Column("specialization", sa.String(length=500), nullable=True),
        sa.Column("experience_years", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["teacher_id"],
            ["teachers.id"],
            name="fk_teacher_employment_profiles_teacher_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "teacher_id",
            name="uq_teacher_employment_profiles_teacher_id",
        ),
    )

    op.create_index(
        "ix_teacher_employment_profiles_teacher_id",
        "teacher_employment_profiles",
        ["teacher_id"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "teacher_employment_profiles" not in inspector.get_table_names():
        return

    indexes = inspector.get_indexes("teacher_employment_profiles")
    if any(
        index.get("name") == "ix_teacher_employment_profiles_teacher_id"
        for index in indexes
    ):
        op.drop_index(
            "ix_teacher_employment_profiles_teacher_id",
            table_name="teacher_employment_profiles",
        )

    op.drop_table("teacher_employment_profiles")
