from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.rbac import Permission, RolePermission
from app.models.user import User


def require_permission(permission_code: str):
    """
    Database-backed RBAC permission dependency.

    Checks:
        current_user.role_id
        -> Permission.code
        -> RolePermission.allowed
    """

    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:

        # --------------------------------------------------
        # User must have an RBAC role
        # --------------------------------------------------
        if current_user.role_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No RBAC role is assigned to this user.",
            )

        # --------------------------------------------------
        # Find active permission by exact code
        # --------------------------------------------------
        permission = db.scalar(
            select(Permission).where(
                Permission.code == permission_code,
                Permission.is_active.is_(True),
            )
        )

        if permission is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission not configured: {permission_code}",
            )

        # --------------------------------------------------
        # Check role -> permission mapping
        # --------------------------------------------------
        role_permission = db.scalar(
            select(RolePermission).where(
                RolePermission.role_id == current_user.role_id,
                RolePermission.permission_id == permission.id,
                RolePermission.allowed.is_(True),
            )
        )

        if role_permission is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission_code}",
            )

        return current_user

    return permission_checker