from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.api.auth import require_role
from app.core.database import get_db
from app.services.notification_service import create_notification
from app.models import (
    Mark,
    Student,
    Exam,
    ExamSubject,
    Teacher,
    TeacherAssignment,
    User,
    Subject,
)
from app.schemas.mark import MarkCreate, MarkUpdate, MarkResponse
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
def build_mark_response(mark: Mark) -> dict:
    percentage = (mark.marks_obtained / mark.max_marks) * 100

    return {
        "id": mark.id,
        "student_id": mark.student_id,
        "exam_id": mark.exam_id,
        "subject_id": mark.subject_id,
        "marks_obtained": mark.marks_obtained,
        "max_marks": mark.max_marks,
        "entered_by": mark.entered_by,
        "created_at": mark.created_at,
        "updated_at": mark.updated_at,
        "percentage": round(percentage, 2),
        "grade": calculate_grade(percentage),
    }
router = APIRouter(
    prefix="/marks",
    tags=["Marks"]
)


@router.post(
    "/",
    response_model=MarkResponse
)
def create_mark(
    data: MarkCreate,
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

    student = (
        db.query(Student)
        .filter(
            Student.id == data.student_id,
            Student.is_active == True
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    exam = (
        db.query(Exam)
        .filter(
            Exam.id == data.exam_id,
            Exam.is_active == True
        )
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found"
        )

    exam_subject = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == data.exam_id,
            ExamSubject.class_id == student.class_id,
            ExamSubject.subject_id == data.subject_id
        )
        .first()
    )

    if not exam_subject:
        raise HTTPException(
            status_code=400,
            detail="Subject is not part of this exam for the student's class"
        )

    teacher_assignment = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_id == teacher.id,
            TeacherAssignment.class_id == student.class_id,
            TeacherAssignment.subject_id == data.subject_id
        )
        .first()
    )

    if not teacher_assignment:
        raise HTTPException(
            status_code=403,
            detail="Teacher is not assigned to this class and subject"
        )

    if data.marks_obtained < 0:
        raise HTTPException(
            status_code=400,
            detail="Marks obtained cannot be negative"
        )

    if data.max_marks <= 0:
        raise HTTPException(
            status_code=400,
            detail="Maximum marks must be greater than zero"
        )

    if data.marks_obtained > data.max_marks:
        raise HTTPException(
            status_code=400,
            detail="Marks obtained cannot exceed maximum marks"
        )

    mark = Mark(
        student_id=data.student_id,
        exam_id=data.exam_id,
        subject_id=data.subject_id,
        marks_obtained=data.marks_obtained,
        max_marks=data.max_marks,
        entered_by=current_user.id,
    )

    db.add(mark)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Marks already entered for this student, exam, and subject"
        )

    db.refresh(mark)
    student_user = db.query(User).filter(
    User.email == student.email,
    User.is_active == True,
    ).first()

    if student_user:
        subject = db.query(Subject).filter(
        Subject.id == mark.subject_id
    ).first()

    subject_name = subject.name if subject else "Subject"

    create_notification(
        db=db,
        user_id=student_user.id,
        title="Marks Updated",
        message=(
            f"Your {subject_name} marks have been updated. "
            f"Marks: {mark.marks_obtained}/{mark.max_marks}."
        ),
        type="marks_updated",
    )


    return build_mark_response(mark)
@router.get(
    "/student/{student_id}",
    response_model=list[MarkResponse]
)
def get_student_marks(
    student_id: int,
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

    teacher_assignment = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_id == teacher.id,
            TeacherAssignment.class_id == student.class_id
        )
        .first()
    )

    if not teacher_assignment:
        raise HTTPException(
            status_code=403,
            detail="Teacher is not assigned to this student's class"
        )

    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student_id
        )
        .order_by(Mark.exam_id.desc())
        .all()
    )

    return [build_mark_response(mark) for mark in marks]
@router.put(
    "/{mark_id}",
    response_model=MarkResponse
)
def update_mark(
    mark_id: int,
    data: MarkUpdate,
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

    mark = (
        db.query(Mark)
        .filter(Mark.id == mark_id)
        .first()
    )

    if not mark:
        raise HTTPException(
            status_code=404,
            detail="Mark not found"
        )

    student = (
        db.query(Student)
        .filter(
            Student.id == mark.student_id,
            Student.is_active == True
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    teacher_assignment = (
        db.query(TeacherAssignment)
        .filter(
            TeacherAssignment.teacher_id == teacher.id,
            TeacherAssignment.class_id == student.class_id,
            TeacherAssignment.subject_id == mark.subject_id
        )
        .first()
    )

    if not teacher_assignment:
        raise HTTPException(
            status_code=403,
            detail="Teacher is not assigned to this class and subject"
        )

    new_marks = (
        data.marks_obtained
        if data.marks_obtained is not None
        else mark.marks_obtained
    )

    new_max_marks = (
        data.max_marks
        if data.max_marks is not None
        else mark.max_marks
    )

    if new_marks < 0:
        raise HTTPException(
            status_code=400,
            detail="Marks obtained cannot be negative"
        )

    if new_max_marks <= 0:
        raise HTTPException(
            status_code=400,
            detail="Maximum marks must be greater than zero"
        )

    if new_marks > new_max_marks:
        raise HTTPException(
            status_code=400,
            detail="Marks obtained cannot exceed maximum marks"
        )

    mark.marks_obtained = new_marks
    mark.max_marks = new_max_marks

    db.commit()
    db.refresh(mark)

    return build_mark_response(mark)
@router.get(
    "/me",
    response_model=list[MarkResponse]
)
def get_my_marks(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
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

    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student.id
        )
        .order_by(Mark.exam_id.desc())
        .all()
    )

    return [build_mark_response(mark) for mark in marks]