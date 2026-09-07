from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Student
from app.schemas.student import StudentCreate, StudentResponse, StudentUpdate
from app.api.auth import require_role
from app.models import Student, SchoolClass
router = APIRouter(
    prefix="/students",
    tags=["Students"],
)


@router.post("/", response_model=StudentResponse)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin")),
):
    
    existing_student = (
        db.query(Student)
        .filter(Student.admission_number == data.admission_number)
        .first()
    )

    if existing_student:
        raise HTTPException(
            status_code=400,
            detail="Admission number is already registered"
        )
    if data.class_id is not None:
        school_class = db.query(SchoolClass).filter(
        SchoolClass.id == data.class_id,
        SchoolClass.is_active == True
        ).first()

    if not school_class:
        raise HTTPException(
            status_code=400,
            detail="Class not found or inactive"
        )
    new_student = Student(
        admission_number=data.admission_number,
        first_name=data.first_name,
        last_name=data.last_name,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        email=data.email,
        phone=data.phone,
        address=data.address,
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return new_student
@router.get("/", response_model=list[StudentResponse])
def get_students(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    students = (
    db.query(Student)
    .filter(Student.is_active == True)
    .all()
)

    return students
@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    student = (
        db.query(Student)
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return student
@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    data: StudentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    student = (
        db.query(Student)
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    update_data = data.model_dump(exclude_unset=True)
    if "class_id" in update_data and update_data["class_id"] is not None:
        school_class = db.query(SchoolClass).filter(
        SchoolClass.id == update_data["class_id"],
        SchoolClass.is_active == True
    ).first()

    if not school_class:
        raise HTTPException(
            status_code=400,
            detail="Class not found or inactive"
        )

    for field, value in update_data.items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)

    return student
@router.delete("/{student_id}", response_model=StudentResponse)
def deactivate_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    student = (
        db.query(Student)
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    student.is_active = False

    db.commit()
    db.refresh(student)

    return student