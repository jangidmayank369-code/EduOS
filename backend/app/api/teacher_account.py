from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.core.security import hash_password
from app.models import Role, Teacher, User
from app.schemas.teacher_account import (
    TeacherAccountCreate,
    TeacherAccountResponse,
    TeacherAccountUpdate,
)


router = APIRouter(
    prefix="/teachers",
    tags=["Teacher Accounts"],
)


def _get_teacher_or_404(
    db: Session,
    teacher_id: int,
) -> Teacher:
    teacher = (
        db.query(Teacher)
        .filter(Teacher.id == teacher_id)
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    return teacher


def _get_teacher_role(
    db: Session,
) -> Role:
    role = (
        db.query(Role)
        .filter(
            Role.is_active.is_(True),
            Role.name.ilike("teacher"),
        )
        .first()
    )

    if not role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TEACHER RBAC role is not configured",
        )

    return role


def _account_response(
    teacher: Teacher,
    user: User,
) -> TeacherAccountResponse:
    return TeacherAccountResponse(
        teacher_id=teacher.id,
        user_id=user.id,
        email=user.email,
        role=user.role,
        role_id=getattr(user, "role_id", None),
        is_active=user.is_active,
    )


@router.get(
    "/{teacher_id}/account",
    response_model=TeacherAccountResponse,
)
def get_teacher_account(
    teacher_id: int,
    current_user: User = Depends(
        require_permission("teachers.view")
    ),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)

    if not teacher.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher login account is not linked",
        )

    user = (
        db.query(User)
        .filter(User.id == teacher.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked user account not found",
        )

    return _account_response(teacher, user)


@router.post(
    "/{teacher_id}/account",
    response_model=TeacherAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_account(
    teacher_id: int,
    data: TeacherAccountCreate,
    current_user: User = Depends(
        require_permission("teachers.update")
    ),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    teacher_role = _get_teacher_role(db)

    if teacher.user_id:
        existing_link = (
            db.query(User)
            .filter(User.id == teacher.user_id)
            .first()
        )

        if existing_link:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Teacher already has a linked login account",
            )

        teacher.user_id = None
        db.flush()

    email = str(data.email).strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    new_user = User(
        email=email,
        password_hash=hash_password(data.password),
        role="teacher",
        role_id=teacher_role.id,
        is_active=True,
    )

    db.add(new_user)

    try:
        db.flush()

        # Never allow a single user account to be linked to another teacher.
        already_linked_teacher = (
            db.query(Teacher)
            .filter(
                Teacher.user_id == new_user.id,
                Teacher.id != teacher.id,
            )
            .first()
        )

        if already_linked_teacher:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User account is already linked to another teacher",
            )

        teacher.user_id = new_user.id
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create teacher login account",
        )

    db.refresh(teacher)
    db.refresh(new_user)

    return _account_response(teacher, new_user)


@router.put(
    "/{teacher_id}/account",
    response_model=TeacherAccountResponse,
)
def update_teacher_account(
    teacher_id: int,
    data: TeacherAccountUpdate,
    current_user: User = Depends(
        require_permission("teachers.update")
    ),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)

    if not teacher.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher login account is not linked",
        )

    user = (
        db.query(User)
        .filter(User.id == teacher.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked user account not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        email = str(update_data["email"]).strip().lower()

        existing_user = (
            db.query(User)
            .filter(
                User.email == email,
                User.id != user.id,
            )
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered",
            )

        user.email = email

    if "password" in update_data and update_data["password"] is not None:
        user.password_hash = hash_password(update_data["password"])

    if "is_active" in update_data:
        user.is_active = update_data["is_active"]

    db.add(user)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to update teacher login account",
        )

    db.refresh(user)

    return _account_response(teacher, user)


@router.delete(
    "/{teacher_id}/account",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unlink_teacher_account(
    teacher_id: int,
    current_user: User = Depends(
        require_permission("teachers.update")
    ),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)

    if not teacher.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher login account is not linked",
        )

    teacher.user_id = None
    db.add(teacher)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to unlink teacher login account",
        )

    return None