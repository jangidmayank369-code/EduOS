"""fix missing exam subject components column

Revision ID: f2a7b8c9d0e1
Revises: e91a6b3c4d5f
Create Date: 2026-09-10
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2a7b8c9d0e1"
down_revision = "e91a6b3c4d5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exam_subjects",
        sa.Column(
            "components",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )

    op.alter_column(
        "exam_subjects",
        "components",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column(
        "exam_subjects",
        "components",
    )