from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Teacher, User,Student,TeacherAssignment
from app.schemas.teacher import TeacherCreate, TeacherResponse, TeacherUpdate
from app.schemas.student import StudentResponse

router = APIRouter(
    prefix="/teachers",
    tags=["Teachers"]
)


@router.get("/", response_model=list[TeacherResponse])
def get_teachers(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    teachers = db.query(Teacher).filter(
        Teacher.is_active == True
    ).all()

    return teachers
@router.post("/", response_model=TeacherResponse)
def create_teacher(
    data: TeacherCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    user = db.query(User).filter(User.id == data.user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.role != "teacher":
        raise HTTPException(
            status_code=400,
            detail="User role must be teacher"
        )

    existing_teacher = db.query(Teacher).filter(
        Teacher.user_id == data.user_id
    ).first()

    if existing_teacher:
        raise HTTPException(
            status_code=400,
            detail="User is already linked to a teacher profile"
        )

    existing_employee = db.query(Teacher).filter(
        Teacher.employee_number == data.employee_number
    ).first()

    if existing_employee:
        raise HTTPException(
            status_code=400,
            detail="Employee number is already registered"
        )

    teacher = Teacher(
        user_id=data.user_id,
        employee_number=data.employee_number,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        email=data.email,
    )

    db.add(teacher)
    db.commit()
    db.refresh(teacher)

    return teacher
@router.get("/{teacher_id}", response_model=TeacherResponse)
def get_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id,
        Teacher.is_active == True
    ).first()

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    return teacher
@router.put("/{teacher_id}", response_model=TeacherResponse)
def update_teacher(
    teacher_id: int,
    data: TeacherUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id,
        Teacher.is_active == True
    ).first()

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    update_data = data.model_dump(exclude_unset=True)

    if "employee_number" in update_data:
        existing_employee = db.query(Teacher).filter(
            Teacher.employee_number == update_data["employee_number"],
            Teacher.id != teacher_id
        ).first()

        if existing_employee:
            raise HTTPException(
                status_code=400,
                detail="Employee number is already registered"
            )

    for field, value in update_data.items():
        setattr(teacher, field, value)

    db.commit()
    db.refresh(teacher)

    return teacher
@router.delete("/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
    ):
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id,
        Teacher.is_active == True
    ).first()

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    teacher.is_active = False

    db.commit()

    return {
        "message": "Teacher deleted successfully"
    }
@router.get(
    "/me",
    response_model=TeacherResponse
)
def get_my_teacher_profile(
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active == True
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found"
        )

    return teacher


@router.get(
    "/me/students",
    response_model=list[StudentResponse]
)
def get_my_students(
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active == True
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found"
        )

    assignments = (
        db.query(TeacherAssignment)
        .filter(TeacherAssignment.teacher_id == teacher.id)
        .all()
    )

    class_ids = list({
        assignment.class_id
        for assignment in assignments
    })

    if not class_ids:
        return []

    students = (
        db.query(Student)
        .filter(
            Student.class_id.in_(class_ids),
            Student.is_active == True
        )
        .all()
    )

    return students