"""add user management permissions

Revision ID: c18f7a92d401
Revises: a75e395fde1b
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa


revision = "c18f7a92d401"
down_revision = "a75e395fde1b"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()

    permissions = [
        {
            "code": "users.view",
            "name": "View Users",
            "module": "users",
            "description": "View users and their assigned roles",
        },
        {
            "code": "users.create",
            "name": "Create Users",
            "module": "users",
            "description": "Create new users and assign roles",
        },
        {
            "code": "users.update",
            "name": "Update Users",
            "module": "users",
            "description": "Activate or deactivate user accounts",
        },
    ]

    for permission in permissions:
        connection.execute(
            sa.text(
                """
                INSERT INTO permissions
                    (code, name, module, description, is_active, created_at)
                VALUES
                    (:code, :name, :module, :description, TRUE, NOW())
                ON CONFLICT (code) DO NOTHING
                """
            ),
            permission,
        )

    connection.execute(
        sa.text(
            """
            INSERT INTO role_permissions
                (role_id, permission_id, allowed, created_at)
            SELECT
                r.id,
                p.id,
                TRUE,
                NOW()
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
              AND p.code IN (
                  'users.view',
                  'users.create',
                  'users.update'
              )
            ON CONFLICT (role_id, permission_id) DO NOTHING
            """
        )
    )


def downgrade():
    connection = op.get_bind()

    connection.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id IN (
                SELECT id
                FROM permissions
                WHERE code IN (
                    'users.view',
                    'users.create',
                    'users.update'
                )
            )
            """
        )
    )

    connection.execute(
        sa.text(
            """
            DELETE FROM permissions
            WHERE code IN (
                'users.view',
                'users.create',
                'users.update'
            )
            """
            
        )
    )