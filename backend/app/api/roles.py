from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.auth import get_current_user
from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.rbac import Permission, Role, RolePermission
from app.models.user import User
from app.schemas.rbac import (
    PermissionResponse,
    RoleCreate,
    RoleDetailResponse,
    RoleListResponse,
    RolePermissionsUpdate,
    RoleResponse,
    RoleUpdate,
)


router = APIRouter(
    prefix="/roles",
    tags=["Roles & RBAC"],
)


def get_role_or_404(
    role_id: int,
    db: Session,
) -> Role:
    result = db.execute(
        select(Role)
        .options(
            selectinload(Role.permissions)
            .selectinload(RolePermission.permission)
        )
        .where(Role.id == role_id)
    )

    role = result.scalar_one_or_none()

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    return role


def ensure_role_management_access(
    role: Role,
    current_user: User,
) -> None:
    """
    SUPER_ADMIN role can only be managed by SUPER_ADMIN.
    Other roles can be managed by users who have the relevant
    permission.
    """

    if role.name == "SUPER_ADMIN" and current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SUPER_ADMIN can manage the SUPER_ADMIN role.",
        )


@router.get(
    "/",
    response_model=RoleListResponse,
)
def list_roles(
    current_user: User = Depends(
        require_permission("roles.view")
    ),
    db: Session = Depends(get_db),
):
    items_result = db.execute(
        select(Role)
        .order_by(Role.id)
    )

    items = items_result.scalars().all()

    total = db.scalar(
        select(func.count(Role.id))
    ) or 0

    return RoleListResponse(
        items=items,
        total=total,
    )


@router.get(
    "/permissions",
    response_model=list[PermissionResponse],
)
def list_permissions(
    current_user: User = Depends(
        require_permission("permissions.view")
    ),
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Permission)
        .where(Permission.is_active.is_(True))
        .order_by(
            Permission.module,
            Permission.code,
        )
    )

    return result.scalars().all()


@router.get(
    "/{role_id}",
    response_model=RoleDetailResponse,
)
def get_role(
    role_id: int,
    current_user: User = Depends(
        require_permission("roles.view")
    ),
    db: Session = Depends(get_db),
):
    return get_role_or_404(role_id, db)


@router.post(
    "/",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_role(
    data: RoleCreate,
    current_user: User = Depends(
        require_permission("roles.create")
    ),
    db: Session = Depends(get_db),
):
    role_name = data.name.strip().upper()

    if role_name == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN role cannot be created manually.",
        )

    existing_role = db.scalar(
        select(Role).where(
            func.upper(Role.name) == role_name
        )
    )

    if existing_role is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A role with this name already exists.",
        )

    role = Role(
        name=role_name,
        description=data.description,
        is_active=True,
    )

    db.add(role)
    db.commit()
    db.refresh(role)

    return role


@router.put(
    "/{role_id}",
    response_model=RoleResponse,
)
def update_role(
    role_id: int,
    data: RoleUpdate,
    current_user: User = Depends(
        require_permission("roles.update")
    ),
    db: Session = Depends(get_db),
):
    role = get_role_or_404(role_id, db)

    ensure_role_management_access(
        role,
        current_user,
    )

    if role.name == "SUPER_ADMIN":
        if data.name is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN role cannot be renamed.",
            )

        if data.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN role cannot be deactivated.",
            )

    if data.name is not None:
        new_name = data.name.strip().upper()

        if new_name == "SUPER_ADMIN" and role.name != "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN role cannot be assigned through role update.",
            )

        existing_role = db.scalar(
            select(Role).where(
                func.upper(Role.name) == new_name,
                Role.id != role.id,
            )
        )

        if existing_role is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A role with this name already exists.",
            )

        role.name = new_name

    if data.description is not None:
        role.description = data.description

    if data.is_active is not None:
        role.is_active = data.is_active

    db.commit()
    db.refresh(role)

    return role


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_role(
    role_id: int,
    current_user: User = Depends(
        require_permission("roles.delete")
    ),
    db: Session = Depends(get_db),
):
    role = get_role_or_404(role_id, db)

    ensure_role_management_access(
        role,
        current_user,
    )

    if role.name == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN role cannot be deleted.",
        )

    role.is_active = False

    db.commit()

    return None


@router.put(
    "/{role_id}/permissions",
    response_model=RoleDetailResponse,
)
def replace_role_permissions(
    role_id: int,
    data: RolePermissionsUpdate,
    current_user: User = Depends(
        require_permission("roles.manage_permissions")
    ),
    db: Session = Depends(get_db),
):
    """
    Replace the complete permission set of a role.

    Semantics:
    - permission listed with allowed=True  -> enabled
    - permission listed with allowed=False -> explicitly disabled
    - permission omitted                    -> removed/disabled

    This makes the endpoint a TRUE replace operation instead of
    only adding/updating the permissions present in the request.
    """

    role = get_role_or_404(role_id, db)

    ensure_role_management_access(
        role,
        current_user,
    )

    if role.name == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN permissions cannot be modified.",
        )

    # ---------------------------------------------------------
    # Validate duplicate permission IDs in request
    # ---------------------------------------------------------

    permission_ids = [
        item.permission_id
        for item in data.permissions
    ]

    if len(permission_ids) != len(set(permission_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate permission_id values are not allowed.",
        )

    # ---------------------------------------------------------
    # Load all active permissions
    # ---------------------------------------------------------

    permissions_result = db.execute(
        select(Permission)
        .where(Permission.is_active.is_(True))
    )

    all_permissions = permissions_result.scalars().all()

    permission_map = {
        permission.id: permission
        for permission in all_permissions
    }

    # ---------------------------------------------------------
    # Validate requested permission IDs
    # ---------------------------------------------------------

    invalid_permission_ids = [
        permission_id
        for permission_id in permission_ids
        if permission_id not in permission_map
    ]

    if invalid_permission_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "One or more permission IDs are invalid.",
                "invalid_permission_ids": invalid_permission_ids,
            },
        )

    requested_permissions = {
        item.permission_id: item.allowed
        for item in data.permissions
    }

    # ---------------------------------------------------------
    # TRUE REPLACE
    #
    # First remove every existing permission assignment.
    # Then create assignments only for permissions supplied
    # in the request.
    # ---------------------------------------------------------

    db.query(RolePermission).filter(
        RolePermission.role_id == role.id
    ).delete(
        synchronize_session=False
    )

    for permission_id, allowed in requested_permissions.items():
        db.add(
            RolePermission(
                role_id=role.id,
                permission_id=permission_id,
                allowed=allowed,
            )
        )

    db.commit()

    # ---------------------------------------------------------
    # Return fresh role with fresh permission assignments
    # ---------------------------------------------------------

    return get_role_or_404(
        role.id,
        db,
    )