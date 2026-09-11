"""create report card templates

Revision ID: b7c4d9e2f611
Revises: a12d7e9f4c21
Create Date: 2026-09-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b7c4d9e2f611"
down_revision: Union[str, Sequence[str], None] = "a12d7e9f4c21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_card_templates",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "name",
            sa.String(length=150),
            nullable=False,
        ),

        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "class_id",
            sa.Integer(),
            sa.ForeignKey(
                "classes.id",
            ),
            nullable=True,
        ),

        sa.Column(
            "academic_session_id",
            sa.Integer(),
            sa.ForeignKey(
                "academic_sessions.id",
            ),
            nullable=True,
        ),

        sa.Column(
            "exam_id",
            sa.Integer(),
            sa.ForeignKey(
                "exams.id",
            ),
            nullable=True,
        ),

        sa.Column(
            "page_size",
            sa.String(length=20),
            nullable=False,
            server_default="A4",
        ),

        sa.Column(
            "orientation",
            sa.String(length=20),
            nullable=False,
            server_default="portrait",
        ),

        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="DRAFT",
        ),

        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),

        sa.Column(
            "elements",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),

        sa.Column(
            "settings",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),

        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("report_card_templates")