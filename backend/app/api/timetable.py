from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.schemas.timetable import TimetableCreate, TimetableResponse
from app.models import (
    Timetable,
    SchoolClass,
    Subject,
    Teacher,
    TeacherAssignment,
    Student,
    Parent,
    ParentChild,
    User,
)
router = APIRouter(prefix="/timetable", tags=["Timetable"])


@router.post("/", response_model=TimetableResponse)
def create_timetable(
    data: TimetableCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    school_class = (
        db.query(SchoolClass)
        .filter(
            SchoolClass.id == data.class_id,
            SchoolClass.is_active == True
        )
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    subject = (
        db.query(Subject)
        .filter(
            Subject.id == data.subject_id,
            Subject.is_active == True
        )
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found"
        )

    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.id == data.teacher_id,
            Teacher.is_active == True
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    if data.day_of_week < 1 or data.day_of_week > 7:
        raise HTTPException(
            status_code=400,
            detail="day_of_week must be between 1 and 7"
        )

    if data.start_time >= data.end_time:
        raise HTTPException(
            status_code=400,
            detail="start_time must be before end_time"
        )

    timetable = Timetable(
        class_id=data.class_id,
        subject_id=data.subject_id,
        teacher_id=data.teacher_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        room_number=data.room_number,
    )

    db.add(timetable)
    db.commit()
    db.refresh(timetable)

    return timetable
@router.get("/", response_model=list[TimetableResponse])
def get_timetables(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    timetables = (
        db.query(Timetable)
        .order_by(Timetable.day_of_week, Timetable.start_time)
        .all()
    )

    return timetables
@router.get("/me", response_model=list[TimetableResponse])
def get_my_timetable(
    current_user: User = Depends(require_role("teacher", "student")),
    db: Session = Depends(get_db),
):
    if current_user.role == "teacher":
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

        timetables = (
            db.query(Timetable)
            .filter(Timetable.teacher_id == teacher.id)
            .order_by(
                Timetable.day_of_week,
                Timetable.start_time,
            )
            .all()
        )

        return timetables

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

    timetables = (
        db.query(Timetable)
        .filter(Timetable.class_id == student.class_id)
        .order_by(
            Timetable.day_of_week,
            Timetable.start_time,
        )
        .all()
    )

    return timetables
@router.get("/me/children/{student_id}", response_model=list[TimetableResponse])
def get_my_child_timetable(
    student_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == current_user.id,
            Parent.is_active == True,
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found",
        )

    parent_child = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
            ParentChild.student_id == student_id,
        )
        .first()
    )

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's timetable",
        )

    student = (
        db.query(Student)
        .filter(
            Student.id == student_id,
            Student.is_active == True,
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    if student.class_id is None:
        return []

    timetables = (
        db.query(Timetable)
        .filter(Timetable.class_id == student.class_id)
        .order_by(
            Timetable.day_of_week,
            Timetable.start_time,
        )
        .all()
    )

    return timetables