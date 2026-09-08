from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.api.auth import require_role
from app.core.database import get_db

from app.models import (
    Attendance,
    Student,
    Teacher,
    TeacherAssignment,
    User,
    Parent,
    ParentChild,
)

from app.schemas.attendance import (
    AttendanceCreate,
    AttendanceResponse,
)

from app.services.notification_service import create_notification


router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
)


@router.post(
    "/",
    response_model=AttendanceResponse,
)
def mark_attendance(
    data: AttendanceCreate,
    current_user: User = Depends(
        require_role("teacher")
    ),
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(
        Teacher.user_id == current_user.id,
        Teacher.is_active == True,
    ).first()

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    student = db.query(Student).filter(
        Student.id == data.student_id,
        Student.is_active == True,
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    assignment = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher.id,
        TeacherAssignment.class_id == student.class_id,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this student's class",
        )

    attendance = Attendance(
        student_id=data.student_id,
        date=data.date,
        status=data.status,
        marked_by=current_user.id,
    )

    db.add(attendance)

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Attendance already marked for this student on this date",
        )

    db.refresh(attendance)

    # Send notification to parents when student is absent
    if data.status.lower() == "absent":

        parent_links = db.query(ParentChild).filter(
            ParentChild.student_id == student.id
        ).all()

        for parent_link in parent_links:

            parent = db.query(Parent).filter(
                Parent.id == parent_link.parent_id,
                Parent.is_active == True,
            ).first()

            if not parent:
                continue

            parent_user = db.query(User).filter(
                User.id == parent.user_id,
                User.is_active == True,
            ).first()

            if not parent_user:
                continue

            create_notification(
                db=db,
                user_id=parent_user.id,
                title="Attendance Alert",
                message=(
                    f"{student.first_name} {student.last_name} "
                    f"was marked absent on {attendance.date}."
                ),
                type="attendance_absent",
            )

    return attendance


@router.get(
    "/student/{student_id}",
    response_model=list[AttendanceResponse],
)
def get_student_attendance(
    student_id: int,
    current_user: User = Depends(
        require_role("admin", "teacher")
    ),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(
        Student.id == student_id,
        Student.is_active == True,
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    # Admin can view attendance of any student
    if current_user.role == "admin":
        attendance = db.query(Attendance).filter(
            Attendance.student_id == student_id
        ).order_by(
            Attendance.date.desc()
        ).all()

        return attendance

    # Teacher can only view students from assigned classes
    teacher = db.query(Teacher).filter(
        Teacher.user_id == current_user.id,
        Teacher.is_active == True,
    ).first()

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    assignment = db.query(TeacherAssignment).filter(
        TeacherAssignment.teacher_id == teacher.id,
        TeacherAssignment.class_id == student.class_id,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this student's class",
        )

    attendance = db.query(Attendance).filter(
        Attendance.student_id == student_id
    ).order_by(
        Attendance.date.desc()
    ).all()

    return attendance