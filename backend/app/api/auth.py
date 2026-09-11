from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.models import User, Role
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    try:
        payload = decode_access_token(token)

        user_id_value = payload.get("sub")

        if user_id_value is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token",
            )

        user_id = int(user_id_value)

    except HTTPException:
        raise

    except (
        JWTError,
        ValueError,
        KeyError,
        TypeError,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User account is inactive",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    return user


# ============================================================
# ROLE CHECK
# ============================================================

def require_role(*allowed_roles):
    def role_checker(
        current_user: User = Depends(get_current_user),
    ):
        current_role = (
            current_user.role.strip().lower()
            if current_user.role
            else ""
        )

        normalized_allowed_roles = {
            role.strip().lower()
            for role in allowed_roles
        }

        if current_role not in normalized_allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have permission to access "
                    "this resource"
                ),
            )

        return current_user

    return role_checker


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=RegisterResponse,
)
def register_user(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(
            User.email == data.email,
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered",
        )

    requested_role = (
        data.role.strip().lower()
    )

    role_mapping = {
        "admin": "ADMIN",
        "teacher": "TEACHER",
        "parent": "PARENT",
        "student": "STUDENT",
        "accountant": "ACCOUNTANT",
        "receptionist": "RECEPTIONIST",
    }

    rbac_role_name = role_mapping.get(
        requested_role
    )

    if not rbac_role_name:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid role. Allowed roles: "
                "admin, teacher, parent, student, "
                "accountant, receptionist"
            ),
        )

    rbac_role = (
        db.query(Role)
        .filter(
            Role.name == rbac_role_name,
            Role.is_active.is_(True),
        )
        .first()
    )

    if not rbac_role:
        raise HTTPException(
            status_code=500,
            detail=(
                "RBAC role configuration is missing"
            ),
        )

    hashed_password = hash_password(
        data.password
    )

    new_user = User(
        email=data.email,
        password_hash=hashed_password,

        # Backward-compatible role
        role=requested_role,

        # Database RBAC role
        role_id=rbac_role.id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
    }


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=LoginResponse,
)
def login_user(
    data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(
            User.email == data.username,
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User account is inactive",
        )

    if not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# ============================================================
# CURRENT USER DETAILS
# ============================================================

@router.get("/me")
def get_me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "rbac_role": (
            current_user.rbac_role.name
            if current_user.rbac_role
            else None
        ),
    }