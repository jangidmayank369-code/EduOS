"""merge section academics and existing migration heads

Revision ID: ef53a852aeab
Revises: 67f33d8246b8, 8b7e2c4d1f90
Create Date: 2026-09-11 23:39:25.467767

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef53a852aeab'
down_revision: Union[str, Sequence[str], None] = ('67f33d8246b8', '8b7e2c4d1f90')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
