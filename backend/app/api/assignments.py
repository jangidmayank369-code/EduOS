from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import (
    Assignment,
    SchoolClass,
    Subject,
    Teacher,
    TeacherAssignment,
    Student,
    User,
    Parent,
    ParentChild,
)
from app.schemas.assignment import AssignmentCreate, AssignmentResponse
from app.services.notification_service import create_notification


router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.post("/", response_model=AssignmentResponse)
def create_assignment(
    data: AssignmentCreate,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active == True,
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    school_class = (
        db.query(SchoolClass)
        .filter(
            SchoolClass.id == data.class_id,
            SchoolClass.is_active == True,
        )
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found",
        )

    subject = (
        db.query(Subject)
        .filter(
            Subject.id == data.subject_id,
            Subject.is_active == True,
        )
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    assignment = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_id == teacher.id,
            TeacherAssignment.class_id == data.class_id,
            TeacherAssignment.subject_id == data.subject_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to teach this class and subject",
        )

    if data.max_marks <= 0:
        raise HTTPException(
            status_code=400,
            detail="max_marks must be greater than 0",
        )

    new_assignment = Assignment(
        class_id=data.class_id,
        subject_id=data.subject_id,
        teacher_id=teacher.id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        max_marks=data.max_marks,
        is_active=True,
    )

    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    students = db.query(Student).filter(
    Student.class_id == new_assignment.class_id,
    Student.is_active == True,
    ).all()

    for student in students:
        student_user = db.query(User).filter(
        User.email == student.email,
        User.is_active == True,
    ).first()

    if student_user:
        create_notification(
            db=db,
            user_id=student_user.id,
            title="New Assignment",
            message=f"New assignment: {new_assignment.title}",
            type="assignment",
        )

    return new_assignment
@router.get("/", response_model=list[AssignmentResponse])
def get_my_assignments(
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active == True,
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.teacher_id == teacher.id,
            Assignment.is_active == True,
        )
        .order_by(Assignment.due_date)
        .all()
    )

    return assignments
@router.get("/me", response_model=list[AssignmentResponse])
def get_my_assignments_as_student(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    student = (
        db.query(Student)
        .filter(
            Student.email == current_user.email,
            Student.is_active == True,
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found",
        )

    if student.class_id is None:
        return []

    assignments = (
        db.query(Assignment)
        .filter(
            Assignment.class_id == student.class_id,
            Assignment.is_active == True,
        )
        .order_by(Assignment.due_date)
        .all()
    )

    return assignments
@router.get("/me/children/{student_id}", response_model=list[AssignmentResponse])
def get_my_child_assignments(
    student_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = db.query(Parent).filter(
        Parent.user_id == current_user.id,
        Parent.is_active == True
    ).first()

    if not parent:
        raise HTTPException(status_code=404, detail="Parent profile not found")

    parent_child = db.query(ParentChild).filter(
        ParentChild.parent_id == parent.id,
        ParentChild.student_id == student_id
    ).first()

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's assignments"
        )

    student = db.query(Student).filter(
        Student.id == student_id,
        Student.is_active == True
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not student.class_id:
        return []

    assignments = db.query(Assignment).filter(
        Assignment.class_id == student.class_id,
        Assignment.is_active == True
    ).order_by(Assignment.due_date.asc()).all()

    return assignments