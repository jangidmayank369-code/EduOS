"""add role management permissions

Revision ID: 7f3a9c2d1e44
Revises: c18f7a92d401
Create Date: 2026-09-09
"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa


revision = "7f3a9c2d1e44"
down_revision = "c18f7a92d401"
branch_labels = None
depends_on = None


ROLE_PERMISSIONS = [
    {
        "code": "roles.view",
        "name": "View Roles",
        "module": "roles",
        "description": "View available roles and their configuration.",
    },
    {
        "code": "roles.create",
        "name": "Create Roles",
        "module": "roles",
        "description": "Create new custom roles.",
    },
    {
        "code": "roles.update",
        "name": "Update Roles",
        "module": "roles",
        "description": "Update role details.",
    },
    {
        "code": "roles.delete",
        "name": "Delete Roles",
        "module": "roles",
        "description": "Deactivate or delete roles.",
    },
    {
        "code": "roles.manage_permissions",
        "name": "Manage Role Permissions",
        "module": "roles",
        "description": "Assign or remove permissions from roles.",
    },
    {
        "code": "permissions.view",
        "name": "View Permissions",
        "module": "permissions",
        "description": "View available system permissions.",
    },
]


def upgrade() -> None:
    bind = op.get_bind()

    now = datetime.utcnow()

    roles_table = sa.table(
        "roles",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
    )

    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Integer),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("module", sa.String),
        sa.column("description", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime),
    )

    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("id", sa.Integer),
        sa.column("role_id", sa.Integer),
        sa.column("permission_id", sa.Integer),
        sa.column("allowed", sa.Boolean),
        sa.column("created_at", sa.DateTime),
    )

    # ---------------------------------------------------------
    # 1. Create permissions if they don't already exist
    # ---------------------------------------------------------

    permission_ids = {}

    for permission in ROLE_PERMISSIONS:
        existing = bind.execute(
            sa.select(permissions_table.c.id)
            .where(permissions_table.c.code == permission["code"])
        ).scalar_one_or_none()

        if existing is not None:
            permission_ids[permission["code"]] = existing
            continue

        result = bind.execute(
            permissions_table.insert()
            .values(
                code=permission["code"],
                name=permission["name"],
                module=permission["module"],
                description=permission["description"],
                is_active=True,
                created_at=now,
            )
            .returning(permissions_table.c.id)
        )

        permission_ids[permission["code"]] = result.scalar_one()

    # ---------------------------------------------------------
    # 2. Give full role-management permissions to SUPER_ADMIN
    # ---------------------------------------------------------

    super_admin_id = bind.execute(
        sa.select(roles_table.c.id)
        .where(roles_table.c.name == "SUPER_ADMIN")
    ).scalar_one_or_none()

    if super_admin_id is not None:
        for permission_id in permission_ids.values():
            existing = bind.execute(
                sa.select(role_permissions_table.c.id)
                .where(
                    role_permissions_table.c.role_id == super_admin_id,
                    role_permissions_table.c.permission_id == permission_id,
                )
            ).scalar_one_or_none()

            if existing is None:
                bind.execute(
                    role_permissions_table.insert().values(
                        role_id=super_admin_id,
                        permission_id=permission_id,
                        allowed=True,
                        created_at=now,
                    )
                )

    # ---------------------------------------------------------
    # 3. Give role-management permissions to ADMIN
    #
    # ADMIN can manage normal roles.
    # The future API will prevent ADMIN from modifying
    # SUPER_ADMIN itself.
    # ---------------------------------------------------------

    admin_id = bind.execute(
        sa.select(roles_table.c.id)
        .where(roles_table.c.name == "ADMIN")
    ).scalar_one_or_none()

    if admin_id is not None:
        for permission_id in permission_ids.values():
            existing = bind.execute(
                sa.select(role_permissions_table.c.id)
                .where(
                    role_permissions_table.c.role_id == admin_id,
                    role_permissions_table.c.permission_id == permission_id,
                )
            ).scalar_one_or_none()

            if existing is None:
                bind.execute(
                    role_permissions_table.insert().values(
                        role_id=admin_id,
                        permission_id=permission_id,
                        allowed=True,
                        created_at=now,
                    )
                )


def downgrade() -> None:
    bind = op.get_bind()

    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Integer),
        sa.column("code", sa.String),
    )

    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("id", sa.Integer),
        sa.column("role_id", sa.Integer),
        sa.column("permission_id", sa.Integer),
    )

    permission_codes = [permission["code"] for permission in ROLE_PERMISSIONS]

    permission_ids = bind.execute(
        sa.select(permissions_table.c.id)
        .where(permissions_table.c.code.in_(permission_codes))
    ).scalars().all()

    if permission_ids:
        bind.execute(
            role_permissions_table.delete()
            .where(
                role_permissions_table.c.permission_id.in_(permission_ids)
            )
        )

        bind.execute(
            permissions_table.delete()
            .where(
                permissions_table.c.id.in_(permission_ids)
            )
        )