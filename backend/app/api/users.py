from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.core.security import hash_password
from app.models.rbac import Role
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserRoleUpdate,
    UserStatusUpdate,
)


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


def get_user_or_404(
    user_id: int,
    db: Session,
) -> User:
    user = db.scalar(
        select(User).where(User.id == user_id)
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return user


def get_role_or_404(
    role_id: int,
    db: Session,
) -> Role:
    role = db.scalar(
        select(Role).where(Role.id == role_id)
    )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found.",
        )

    if not role.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign an inactive role.",
        )

    return role


def ensure_super_admin_protection(
    target_user: User,
    current_user: User,
) -> None:
    """
    SUPER_ADMIN users can only be managed by SUPER_ADMIN.
    """

    if target_user.role == "super_admin":
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only SUPER_ADMIN can manage "
                    "a SUPER_ADMIN user."
                ),
            )


@router.get(
    "/",
    response_model=list[UserResponse],
)
def list_users(
    current_user: User = Depends(
        require_permission("users.view")
    ),
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(User).order_by(User.id)
    )

    return result.scalars().all()


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    data: UserCreate,
    current_user: User = Depends(
        require_permission("users.create")
    ),
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # Duplicate email check
    # ---------------------------------------------------------

    existing_user = db.scalar(
        select(User).where(
            User.email == str(data.email)
        )
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    # ---------------------------------------------------------
    # Validate RBAC role
    # ---------------------------------------------------------

    role = get_role_or_404(
        data.role_id,
        db,
    )

    # ---------------------------------------------------------
    # SUPER_ADMIN creation protection
    # ---------------------------------------------------------

    if role.name == "SUPER_ADMIN":
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only SUPER_ADMIN can create "
                    "a SUPER_ADMIN user."
                ),
            )

    # ---------------------------------------------------------
    # Legacy role field
    # ---------------------------------------------------------

    legacy_role = role.name.lower()

    user = User(
        email=str(data.email),
        password_hash=hash_password(data.password),
        role=legacy_role,
        role_id=role.id,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
)
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    current_user: User = Depends(
        require_permission("users.update")
    ),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(
        user_id,
        db,
    )

    ensure_super_admin_protection(
        user,
        current_user,
    )

    # SUPER_ADMIN cannot be deactivated.
    if (
        user.role == "super_admin"
        and not data.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN user cannot be deactivated.",
        )

    user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    return user


@router.patch(
    "/{user_id}/role",
    response_model=UserResponse,
)
def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    current_user: User = Depends(
        require_permission("users.update")
    ),
    db: Session = Depends(get_db),
):
    user = get_user_or_404(
        user_id,
        db,
    )

    ensure_super_admin_protection(
        user,
        current_user,
    )

    new_role = get_role_or_404(
        data.role_id,
        db,
    )

    # ---------------------------------------------------------
    # SUPER_ADMIN assignment protection
    # ---------------------------------------------------------

    if new_role.name == "SUPER_ADMIN":
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only SUPER_ADMIN can assign "
                    "the SUPER_ADMIN role."
                ),
            )

    # ---------------------------------------------------------
    # SUPER_ADMIN downgrade protection
    # ---------------------------------------------------------

    if user.role == "super_admin":
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only SUPER_ADMIN can change "
                    "a SUPER_ADMIN user's role."
                ),
            )

    # ---------------------------------------------------------
    # Synchronize RBAC + legacy role
    # ---------------------------------------------------------

    user.role_id = new_role.id
    user.role = new_role.name.lower()

    db.commit()
    db.refresh(user)

    return user