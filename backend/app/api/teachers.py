from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.core.security import hash_password
from app.models import Teacher, User, Student, TeacherAssignment
from app.schemas.teacher import (
    TeacherCreate,
    TeacherResponse,
    TeacherUpdate,
)
from app.schemas.student import StudentResponse


router = APIRouter(
    prefix="/teachers",
    tags=["Teachers"],
)


@router.get(
    "/",
    response_model=list[TeacherResponse],
)
def get_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("teachers.view")
    ),
):
    teachers = (
        db.query(Teacher)
        .filter(Teacher.is_active.is_(True))
        .all()
    )

    return teachers


@router.post(
    "/",
    response_model=TeacherResponse,
)
def create_teacher(
    data: TeacherCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("teachers.create")
    ),
):
    # ---------------------------------------------------------
    # Validate duplicate login email
    # ---------------------------------------------------------
    existing_user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered",
        )

    # ---------------------------------------------------------
    # Validate duplicate employee number
    # ---------------------------------------------------------
    existing_employee = (
        db.query(Teacher)
        .filter(
            Teacher.employee_number == data.employee_number
        )
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=400,
            detail="Employee number is already registered",
        )

    # ---------------------------------------------------------
    # Find TEACHER RBAC role
    # ---------------------------------------------------------
    from app.models import Role

    teacher_role = (
        db.query(Role)
        .filter(
            Role.name == "TEACHER",
            Role.is_active.is_(True),
        )
        .first()
    )

    if not teacher_role:
        raise HTTPException(
            status_code=500,
            detail="TEACHER RBAC role is not configured",
        )

    # ---------------------------------------------------------
    # Create login user + teacher profile in ONE transaction
    # ---------------------------------------------------------
    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="teacher",
        role_id=teacher_role.id,
    )

    db.add(new_user)
    db.flush()

    teacher = Teacher(
        user_id=new_user.id,
        employee_number=data.employee_number,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        email=data.email,
    )

    db.add(teacher)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Unable to create teacher account",
        )

    db.refresh(teacher)

    return teacher


@router.get(
    "/{teacher_id}",
    response_model=TeacherResponse,
)
def get_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("teachers.view")
    ),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.id == teacher_id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found",
        )

    return teacher


@router.put(
    "/{teacher_id}",
    response_model=TeacherResponse,
)
def update_teacher(
    teacher_id: int,
    data: TeacherUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("teachers.update")
    ),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.id == teacher_id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found",
        )

    update_data = data.model_dump(
        exclude_unset=True
    )

    # ---------------------------------------------------------
    # Employee number uniqueness
    # ---------------------------------------------------------
    if "employee_number" in update_data:
        existing_employee = (
            db.query(Teacher)
            .filter(
                Teacher.employee_number
                == update_data["employee_number"],
                Teacher.id != teacher_id,
            )
            .first()
        )

        if existing_employee:
            raise HTTPException(
                status_code=400,
                detail="Employee number is already registered",
            )

    # ---------------------------------------------------------
    # Email update
    #
    # Teacher email is also the login email, so keep both
    # User.email and Teacher.email synchronized.
    # ---------------------------------------------------------
    if "email" in update_data:
        new_email = update_data["email"]

        if new_email:
            existing_user = (
                db.query(User)
                .filter(
                    User.email == new_email,
                    User.id != teacher.user_id,
                )
                .first()
            )

            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Email is already registered",
                )

            user = (
                db.query(User)
                .filter(User.id == teacher.user_id)
                .first()
            )

            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="Teacher login account not found",
                )

            user.email = new_email

    for field, value in update_data.items():
        setattr(teacher, field, value)

    db.commit()
    db.refresh(teacher)

    return teacher


@router.delete(
    "/{teacher_id}",
)
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("teachers.delete")
    ),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.id == teacher_id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found",
        )

    teacher.is_active = False

    # Deactivate the linked login account as well.
    user = (
        db.query(User)
        .filter(User.id == teacher.user_id)
        .first()
    )

    if user:
        user.is_active = False

    db.commit()

    return {
        "message": "Teacher and login account deactivated successfully"
    }


@router.get(
    "/me",
    response_model=TeacherResponse,
)
def get_my_teacher_profile(
    current_user: User = Depends(
        require_permission("teachers.view")
    ),
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    return teacher


@router.get(
    "/me/students",
    response_model=list[StudentResponse],
)
def get_my_students(
    current_user: User = Depends(
        require_permission("students.view")
    ),
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    assignments = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_id == teacher.id
        )
        .all()
    )

    class_ids = list(
        {
            assignment.class_id
            for assignment in assignments
        }
    )

    if not class_ids:
        return []

    students = (
        db.query(Student)
        .filter(
            Student.class_id.in_(class_ids),
            Student.is_active.is_(True),
        )
        .all()
    )

    return students