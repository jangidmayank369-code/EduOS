"""add role mapping to users

Revision ID: a75e395fde1b
Revises: 4ad832541b77
Create Date: 2026-09-09 17:02:58.695453

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a75e395fde1b"
down_revision: Union[str, Sequence[str], None] = "4ad832541b77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add database-backed RBAC role mapping to existing users.

    The existing users.role column is intentionally preserved for
    backward compatibility with the current authentication system.
    """

    # Add nullable role_id first so existing users remain valid.
    op.add_column(
        "users",
        sa.Column(
            "role_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_index(
        op.f("ix_users_role_id"),
        "users",
        ["role_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_users_role_id_roles",
        "users",
        "roles",
        ["role_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ---------------------------------------------------------
    # Map existing users to the new RBAC roles.
    #
    # Existing User.role values are preserved.
    # Only known roles are mapped.
    # ---------------------------------------------------------

    connection = op.get_bind()

    connection.execute(
        sa.text(
            """
            UPDATE users
            SET role_id = (
                SELECT id
                FROM roles
                WHERE roles.name = 'ADMIN'
            )
            WHERE LOWER(role) = 'admin'
              AND role_id IS NULL
            """
        )
    )

    connection.execute(
        sa.text(
            """
            UPDATE users
            SET role_id = (
                SELECT id
                FROM roles
                WHERE roles.name = 'TEACHER'
            )
            WHERE LOWER(role) = 'teacher'
              AND role_id IS NULL
            """
        )
    )

    connection.execute(
        sa.text(
            """
            UPDATE users
            SET role_id = (
                SELECT id
                FROM roles
                WHERE roles.name = 'PARENT'
            )
            WHERE LOWER(role) = 'parent'
              AND role_id IS NULL
            """
        )
    )

    connection.execute(
        sa.text(
            """
            UPDATE users
            SET role_id = (
                SELECT id
                FROM roles
                WHERE roles.name = 'STUDENT'
            )
            WHERE LOWER(role) = 'student'
              AND role_id IS NULL
            """
        )
    )


def downgrade() -> None:
    """
    Remove only the new RBAC role mapping.

    The existing users.role column remains untouched.
    """

    op.drop_constraint(
        "fk_users_role_id_roles",
        "users",
        type_="foreignkey",
    )

    op.drop_index(
        op.f("ix_users_role_id"),
        table_name="users",
    )

    op.drop_column(
        "users",
        "role_id",
    )