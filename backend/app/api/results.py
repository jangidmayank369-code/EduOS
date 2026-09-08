from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.services.notification_service import create_notification

from app.api.auth import require_role
from app.core.database import get_db
from app.models import (
    Mark,
    Student,
    Exam,
    Teacher,
    TeacherAssignment,
    User,
    Result,
    Parent,
    ParentChild,
)
from app.schemas.result import ResultResponse
from app.core.database import get_db


router = APIRouter(
    prefix="/results",
    tags=["Results"]
)


def calculate_grade(percentage: float) -> str:
    if percentage >= 90:
        return "A+"
    elif percentage >= 80:
        return "A"
    elif percentage >= 70:
        return "B+"
    elif percentage >= 60:
        return "B"
    elif percentage >= 50:
        return "C"
    elif percentage >= 40:
        return "D"
    else:
        return "F"


def build_result_response(
    student_id: int,
    exam_id: int,
    marks: list[Mark],
) -> dict:

    subjects = []

    for mark in marks:
        percentage = (mark.marks_obtained / mark.max_marks) * 100

        subjects.append(
            {
                "subject_id": mark.subject_id,
                "subject_name": mark.subject.name,
                "marks_obtained": mark.marks_obtained,
                "max_marks": mark.max_marks,
                "percentage": round(percentage, 2),
                "grade": calculate_grade(percentage),
            }
        )

    total_marks = sum(
        mark.marks_obtained
        for mark in marks
    )

    max_marks = sum(
        mark.max_marks
        for mark in marks
    )

    percentage = (total_marks / max_marks) * 100

    return {
        "student_id": student_id,
        "exam_id": exam_id,
        "subjects": subjects,
        "total_marks": total_marks,
        "max_marks": max_marks,
        "percentage": round(percentage, 2),
        "grade": calculate_grade(percentage),
    }


# ---------------------------------------------------------
# TEACHER: View a student's result
# ---------------------------------------------------------

@router.get(
    "/student/{student_id}/exam/{exam_id}",
    response_model=ResultResponse
)
def get_student_result(
    student_id: int,
    exam_id: int,
    current_user: User = Depends(require_role("teacher")),
    db: Session = Depends(get_db),
):

    # Find student
    student = (
        db.query(Student)
        .filter(
            Student.id == student_id,
            Student.is_active == True
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # Find teacher profile
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

    # Check teacher is assigned to student's class
    assignment = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_id == teacher.id,
            TeacherAssignment.class_id == student.class_id
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this student's class"
        )

    # Find exam
    exam = (
        db.query(Exam)
        .filter(
            Exam.id == exam_id,
            Exam.is_active == True
        )
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found"
        )

    # Get student's marks
    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student_id,
            Mark.exam_id == exam_id
        )
        .all()
    )

    if not marks:
        raise HTTPException(
            status_code=404,
            detail="No marks found for this student and exam"
        )

    return build_result_response(
        student_id=student_id,
        exam_id=exam_id,
        marks=marks
    )


# ---------------------------------------------------------
# STUDENT: View own result
# ---------------------------------------------------------

@router.get(
    "/me/exam/{exam_id}",
    response_model=ResultResponse
)
def get_my_result(
    exam_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):

    # Find student profile using logged-in user's email
    student = (
        db.query(Student)
        .filter(
            Student.email == current_user.email,
            Student.is_active == True
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found"
        )

    # Find exam
    exam = (
        db.query(Exam)
        .filter(
            Exam.id == exam_id,
            Exam.is_active == True
        )
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found"
        )

    # Get student's marks
    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student.id,
            Mark.exam_id == exam_id
        )
        .all()
    )

    if not marks:
        raise HTTPException(
            status_code=404,
            detail="No marks found for this exam"
        )

    return build_result_response(
        student_id=student.id,
        exam_id=exam_id,
        marks=marks
    )
@router.post(
    "/{student_id}/exam/{exam_id}/publish",
    response_model=ResultResponse
)
def publish_result(
    student_id: int,
    exam_id: int,
    current_user: User = Depends(require_role("teacher")),
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

    exam = db.query(Exam).filter(
        Exam.id == exam_id,
        Exam.is_active == True,
    ).first()

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found",
        )

    marks = db.query(Mark).filter(
        Mark.student_id == student_id,
        Mark.exam_id == exam_id,
    ).all()

    if not marks:
        raise HTTPException(
            status_code=404,
            detail="No marks found for this student and exam",
        )

    result = db.query(Result).filter(
        Result.student_id == student_id,
        Result.exam_id == exam_id,
    ).first()

    if result and result.is_published:
        raise HTTPException(
            status_code=400,
            detail="Result is already published",
        )

    if not result:
        result = Result(
            student_id=student_id,
            exam_id=exam_id,
            is_published=True,
        )
        db.add(result)
    else:
        result.is_published = True

    db.commit()
    db.refresh(result)

    student_user = db.query(User).filter(
       User.email == student.email,
       User.is_active == True,
    ).first()

    if student_user:
        create_notification(
        db=db,
        user_id=student_user.id,
        title="Result Published",
        message=f"Your result for {exam.name} has been published.",
        type="result_published",
    )

    parent_links = db.query(ParentChild).filter(
        ParentChild.student_id == student.id
    ).all()

    for parent_link in parent_links:
        parent = db.query(Parent).filter(
        Parent.id == parent_link.parent_id,
        Parent.is_active == True,
    ).first()

    if parent:
        parent_user = db.query(User).filter(
            User.id == parent.user_id,
            User.is_active == True,
        ).first()

        if parent_user:
            create_notification(
                db=db,
                user_id=parent_user.id,
                title="Result Published",
                message=(
                    f"{student.first_name} {student.last_name}'s "
                    f"result for {exam.name} has been published."
                ),
                type="result_published",
            )

    return build_result_response(
    student_id=student_id,
    exam_id=exam_id,
    marks=marks,
)