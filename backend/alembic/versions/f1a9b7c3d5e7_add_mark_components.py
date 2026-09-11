"""add mark components

Revision ID: f1a9b7c3d5e7
Revises: d42f6a8b9012
Create Date: 2026-09-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a9b7c3d5e7"
down_revision: Union[str, None] = "d42f6a8b9012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mark_components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mark_id", sa.Integer(), nullable=False),
        sa.Column(
            "component_key",
            sa.String(length=80),
            nullable=False,
        ),
        sa.Column(
            "component_name",
            sa.String(length=120),
            nullable=False,
        ),
        sa.Column(
            "component_type",
            sa.String(length=30),
            server_default="OTHER",
            nullable=False,
        ),
        sa.Column(
            "marks_obtained",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "max_marks",
            sa.Float(),
            nullable=False,
        ),
        sa.Column(
            "pass_marks",
            sa.Float(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "entered_by",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["mark_id"],
            ["marks.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["entered_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "mark_id",
            "component_key",
            name="uq_mark_component_mark_key",
        ),
    )

    op.create_index(
        "ix_mark_components_mark_id",
        "mark_components",
        ["mark_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_mark_components_mark_id",
        table_name="mark_components",
    )

    op.drop_table("mark_components")