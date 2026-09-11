"""merge migration heads

Revision ID: 67f33d8246b8
Revises: f1a9b7c3d5e7, f2a7b8c9d0e1
Create Date: 2026-09-11 15:41:03.476361

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '67f33d8246b8'
down_revision: Union[str, Sequence[str], None] = ('f1a9b7c3d5e7', 'f2a7b8c9d0e1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
