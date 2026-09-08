from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import (
    User,
    Teacher,
    SchoolClass,
    Subject,
    ClassSubject,
    TeacherAssignment,
)
from app.schemas.teacher_assignment import (
    TeacherAssignmentCreate,
    TeacherAssignmentResponse,
)

router = APIRouter(
    prefix="/teacher-assignments",
    tags=["Teacher Assignments"]
)
@router.post("/", response_model=TeacherAssignmentResponse)
def create_teacher_assignment(
    data: TeacherAssignmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
    ):
    
    class_subject = db.query(ClassSubject).filter(
        ClassSubject.class_id == data.class_id,
        ClassSubject.subject_id == data.subject_id
    ).first()

    if not class_subject:
        raise HTTPException(
            status_code=400,
            detail="Subject is not assigned to this class"
        )
    existing_assignment = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == data.teacher_id,
        TeacherAssignment.class_id == data.class_id,
        TeacherAssignment.subject_id == data.subject_id
    ).first()

    if existing_assignment:
        raise HTTPException(
            status_code=400,
            detail="Teacher is already assigned to this class and subject"
        )
    assignment = TeacherAssignment(
        teacher_id=data.teacher_id,
        class_id=data.class_id,
        subject_id=data.subject_id,
    )

    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return assignment
    teacher = db.query(Teacher).filter(
        Teacher.id == data.teacher_id,
        Teacher.is_active == True
    ).first()

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == data.class_id,
        SchoolClass.is_active == True
    ).first()

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    subject = db.query(Subject).filter(
        Subject.id == data.subject_id,
        Subject.is_active == True
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found"
        )
@router.get(
    "/teacher/{teacher_id}",
    response_model=list[TeacherAssignmentResponse]
)
def get_teacher_assignments(
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

    assignments = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher_id
    ).all()

    return assignments
@router.delete("/{teacher_id}/{class_id}/{subject_id}")
def delete_teacher_assignment(
    teacher_id: int,
    class_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    assignment = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher_id,
        TeacherAssignment.class_id == class_id,
        TeacherAssignment.subject_id == subject_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Teacher assignment not found"
        )

    db.delete(assignment)
    db.commit()

    return {
        "message": "Teacher assignment deleted successfully"
    }
@router.get(
    "/my-assignments",
    response_model=list[TeacherAssignmentResponse]
)
def get_my_assignments(
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
    ):
    print("CURRENT USER ID:", current_user.id)
    print("CURRENT USER ROLE:", current_user.role)
    teacher = (
    db.query(Teacher)
    .filter(
        Teacher.user_id == current_user.id,
        Teacher.is_active == True
    )
    .first()
    )
    print("TEACHER FOUND:", teacher)
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
    return assignments