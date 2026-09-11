"""merge report card template and user timestamp heads

Revision ID: d42f6a8b9012
Revises: 2596004f78d3, c31e8f7a9021
Create Date: 2026-09-10 15:30:00
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d42f6a8b9012"

down_revision: Union[
    str, Sequence[str], None
] = (
    "2596004f78d3",
    "c31e8f7a9021",
)

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Merge the two Alembic heads:

    2596004f78d3
        -> user timestamps

    c31e8f7a9021
        -> default report card template

    No schema operation is required here because both parent
    migrations have already performed their own changes.
    """
    pass


def downgrade() -> None:
    """
    This is a merge-only migration.

    Downgrading removes the merge point but does not automatically
    downgrade either parent branch.
    """
    pass