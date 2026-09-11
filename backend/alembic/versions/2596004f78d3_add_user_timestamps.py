"""add user timestamps

Revision ID: 2596004f78d3
Revises: b7c4d9e2f611
Create Date: 2026-09-10 10:20:26.636413

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2596004f78d3"
down_revision: Union[str, Sequence[str], None] = "b7c4d9e2f611"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add created_at and updated_at to users table."""

    # ---------------------------------------------------------
    # Add created_at
    #
    # server_default makes this safe for existing users.
    # Existing rows receive the current database timestamp.
    # ---------------------------------------------------------
    op.add_column(
        "users",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # ---------------------------------------------------------
    # Add updated_at
    #
    # Existing rows receive the current database timestamp.
    # ---------------------------------------------------------
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # ---------------------------------------------------------
    # Remove database defaults after existing rows are safely
    # populated.
    #
    # New timestamps are handled by the SQLAlchemy model.
    # ---------------------------------------------------------
    op.alter_column(
        "users",
        "created_at",
        server_default=None,
    )

    op.alter_column(
        "users",
        "updated_at",
        server_default=None,
    )


def downgrade() -> None:
    """Remove user timestamps."""

    op.drop_column(
        "users",
        "updated_at",
    )

    op.drop_column(
        "users",
        "created_at",
    )