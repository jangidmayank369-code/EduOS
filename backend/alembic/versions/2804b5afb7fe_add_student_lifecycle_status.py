"""add student lifecycle status

Revision ID: 2804b5afb7fe
Revises: 37c166363de6
Create Date: 2026-09-08 20:17:27.660964

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2804b5afb7fe"
down_revision: Union[str, Sequence[str], None] = "37c166363de6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # Add the new columns as nullable first so existing students
    # can be migrated safely.
    op.add_column(
        "students",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
        ),
    )

    op.add_column(
        "students",
        sa.Column(
            "status_changed_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.add_column(
        "students",
        sa.Column(
            "status_reason",
            sa.String(length=500),
            nullable=True,
        ),
    )

    # Existing students are considered ACTIVE by default.
    op.execute(
        sa.text(
            """
            UPDATE students
            SET status = 'ACTIVE'
            WHERE status IS NULL
            """
        )
    )

    # Give existing students a lifecycle timestamp.
    op.execute(
        sa.text(
            """
            UPDATE students
            SET status_changed_at = COALESCE(created_at, CURRENT_TIMESTAMP)
            WHERE status_changed_at IS NULL
            """
        )
    )

    # Now that existing rows have valid values,
    # enforce NOT NULL constraints.
    op.alter_column(
        "students",
        "status",
        existing_type=sa.String(length=20),
        nullable=False,
    )

    op.alter_column(
        "students",
        "status_changed_at",
        existing_type=sa.DateTime(),
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column("students", "status_reason")
    op.drop_column("students", "status_changed_at")
    op.drop_column("students", "status")