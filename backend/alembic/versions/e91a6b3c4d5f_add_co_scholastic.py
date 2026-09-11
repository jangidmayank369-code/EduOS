"""add co scholastic components and entries

Revision ID: e91a6b3c4d5f
Revises: c8e7f1a4b2d9
Create Date: 2026-09-10 19:10:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e91a6b3c4d5f"

down_revision: Union[str, Sequence[str], None] = "c8e7f1a4b2d9"

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create co-scholastic configuration and student entry tables."""

    op.create_table(
        "co_scholastic_components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "component_type",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'GRADE'"),
        ),
        sa.Column("max_marks", sa.Float(), nullable=True),
        sa.Column(
            "include_in_result",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
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
            ["class_id"],
            ["classes.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "co_scholastic_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("component_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("marks", sa.Float(), nullable=True),
        sa.Column("grade", sa.String(length=20), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
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
            ["component_id"],
            ["co_scholastic_components.id"],
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "component_id",
            "student_id",
            name="uq_co_scholastic_component_student",
        ),
    )

    # Remove temporary server defaults after table creation.
    op.alter_column(
        "co_scholastic_components",
        "component_type",
        server_default=None,
    )

    op.alter_column(
        "co_scholastic_components",
        "include_in_result",
        server_default=None,
    )

    op.alter_column(
        "co_scholastic_components",
        "display_order",
        server_default=None,
    )

    op.alter_column(
        "co_scholastic_components",
        "is_active",
        server_default=None,
    )


def downgrade() -> None:
    """Remove co-scholastic tables."""

    op.drop_table("co_scholastic_entries")
    op.drop_table("co_scholastic_components")