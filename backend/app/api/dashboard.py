from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db

from app.models import (
    User,
    Student,
    Teacher,
    SchoolClass,
    Subject,
    Fee,
    Assignment,
    TeacherAssignment,
    AssignmentSubmission,
    Attendance,
    Mark,
    Notification,
    Parent,
    ParentChild,
)


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@router.get("/admin")
def admin_dashboard(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    total_students = (
        db.query(Student)
        .filter(Student.is_active == True)
        .count()
    )

    total_teachers = (
        db.query(Teacher)
        .filter(Teacher.is_active == True)
        .count()
    )

    total_classes = (
        db.query(SchoolClass)
        .filter(SchoolClass.is_active == True)
        .count()
    )

    total_subjects = (
        db.query(Subject)
        .filter(Subject.is_active == True)
        .count()
    )

    pending_fees = (
        db.query(Fee)
        .filter(Fee.status != "paid")
        .all()
    )

    total_pending_fee_amount = sum(
        fee.amount_due - fee.amount_paid
        for fee in pending_fees
    )

    active_assignments = (
        db.query(Assignment)
        .filter(Assignment.is_active == True)
        .count()
    )

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_classes": total_classes,
        "total_subjects": total_subjects,
        "total_pending_fee_amount": total_pending_fee_amount,
        "active_assignments": active_assignments,
    }


# ============================================================
# TEACHER DASHBOARD
# ============================================================

@router.get("/teacher")
def teacher_dashboard(
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

    assigned_classes = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_id == teacher.id
        )
        .all()
    )

    class_ids = list({
        assignment.class_id
        for assignment in assigned_classes
    })

    subject_ids = list({
        assignment.subject_id
        for assignment in assigned_classes
    })

    total_students = 0

    if class_ids:
        total_students = (
            db.query(Student)
            .filter(
                Student.class_id.in_(class_ids),
                Student.is_active == True,
            )
            .count()
        )

    active_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.teacher_id == teacher.id,
            Assignment.is_active == True,
        )
        .count()
    )

    pending_submissions = (
        db.query(AssignmentSubmission)
        .join(
            Assignment,
            Assignment.id == AssignmentSubmission.assignment_id,
        )
        .filter(
            Assignment.teacher_id == teacher.id,
            AssignmentSubmission.status == "submitted",
        )
        .count()
    )

    return {
        "teacher_id": teacher.id,
        "assigned_classes": len(class_ids),
        "assigned_subjects": len(subject_ids),
        "total_students": total_students,
        "active_assignments": active_assignments,
        "pending_submissions": pending_submissions,
    }


# ============================================================
# STUDENT DASHBOARD
# ============================================================

@router.get("/student")
def student_dashboard(
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

    total_attendance = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student.id
        )
        .count()
    )

    present_attendance = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student.id,
            Attendance.status.ilike("present"),
        )
        .count()
    )

    attendance_percentage = 0

    if total_attendance > 0:
        attendance_percentage = round(
            (present_attendance / total_attendance) * 100,
            2,
        )

    total_marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student.id
        )
        .count()
    )

    latest_marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student.id
        )
        .order_by(Mark.created_at.desc())
        .limit(5)
        .all()
    )

    pending_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.class_id == student.class_id,
            Assignment.is_active == True,
        )
        .count()
    )

    unread_notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .count()
    )

    return {
        "student_id": student.id,
        "attendance_percentage": attendance_percentage,
        "total_marks_entries": total_marks,
        "latest_marks": [
            {
                "exam_id": mark.exam_id,
                "subject_id": mark.subject_id,
                "marks_obtained": mark.marks_obtained,
                "max_marks": mark.max_marks,
            }
            for mark in latest_marks
        ],
        "pending_assignments": pending_assignments,
        "unread_notifications": unread_notifications,
    }


# ============================================================
# PARENT DASHBOARD
# ============================================================

@router.get("/parent")
def parent_dashboard(
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

    children = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id
        )
        .all()
    )

    children_data = []

    for child_link in children:
        student = (
            db.query(Student)
            .filter(
                Student.id == child_link.student_id,
                Student.is_active == True,
            )
            .first()
        )

        if student:
            pending_assignments = (
                db.query(Assignment)
                .filter(
                    Assignment.class_id == student.class_id,
                    Assignment.is_active == True,
                )
                .count()
            )

            total_attendance = (
                db.query(Attendance)
                .filter(
                    Attendance.student_id == student.id
                )
                .count()
            )

            present_attendance = (
                db.query(Attendance)
                .filter(
                    Attendance.student_id == student.id,
                    Attendance.status.ilike("present"),
                )
                .count()
            )

            attendance_percentage = 0

            if total_attendance > 0:
                attendance_percentage = round(
                    (present_attendance / total_attendance) * 100,
                    2,
                )

            latest_marks = (
                db.query(Mark)
                .filter(
                    Mark.student_id == student.id
                )
                .order_by(Mark.created_at.desc())
                .limit(5)
                .all()
            )

            children_data.append({
                "student_id": student.id,
                "name": f"{student.first_name} {student.last_name}",
                "class_id": student.class_id,
                "pending_assignments": pending_assignments,
                "attendance_percentage": attendance_percentage,
                "latest_marks": [
                    {
                        "exam_id": mark.exam_id,
                        "subject_id": mark.subject_id,
                        "marks_obtained": mark.marks_obtained,
                        "max_marks": mark.max_marks,
                    }
                    for mark in latest_marks
                ],
            })

    unread_notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .count()
    )

    return {
        "parent_id": parent.id,
        "children_count": len(children_data),
        "children": children_data,
        "unread_notifications": unread_notifications,
    }