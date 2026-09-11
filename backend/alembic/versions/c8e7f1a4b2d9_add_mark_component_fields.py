"""add component marks and status to marks

Revision ID: c8e7f1a4b2d9
Revises: d42f6a8b9012
Create Date: 2026-09-10 19:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c8e7f1a4b2d9"

down_revision: Union[str, Sequence[str], None] = "d42f6a8b9012"

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add component-wise marks and mark status support.

    Existing marks remain compatible:
    - component_marks defaults to an empty JSON object.
    - status defaults to PRESENT.
    """

    op.add_column(
        "marks",
        sa.Column(
            "component_marks",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
    )

    op.add_column(
        "marks",
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default=sa.text("'PRESENT'"),
        ),
    )

    # Remove temporary database defaults after existing rows
    # have been populated safely.
    op.alter_column(
        "marks",
        "component_marks",
        server_default=None,
    )

    op.alter_column(
        "marks",
        "status",
        server_default=None,
    )


def downgrade() -> None:
    """
    Remove component-wise marks and mark status support.
    """

    op.drop_column("marks", "status")
    op.drop_column("marks", "component_marks")