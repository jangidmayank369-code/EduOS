from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import (
    Assignment,
    AssignmentSubmission,
    Student,
    Teacher,
    Parent,
    ParentChild,
    User,
)
from app.schemas.assignment_submission import (
    AssignmentSubmissionCreate,
    AssignmentSubmissionUpdate,
    AssignmentSubmissionResponse,
)
from app.services.notification_service import create_notification
router = APIRouter(
    prefix="/assignment-submissions",
    tags=["Assignment Submissions"],
)


@router.post(
    "/",
    response_model=AssignmentSubmissionResponse,
)
def submit_assignment(
    data: AssignmentSubmissionCreate,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(
        Student.email == current_user.email,
        Student.is_active == True,
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found",
        )

    assignment = db.query(Assignment).filter(
        Assignment.id == data.assignment_id,
        Assignment.is_active == True,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    if student.class_id != assignment.class_id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to submit this assignment",
        )

    existing_submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == data.assignment_id,
        AssignmentSubmission.student_id == student.id,
    ).first()

    if existing_submission:
        raise HTTPException(
            status_code=400,
            detail="Assignment already submitted",
        )

    submission = AssignmentSubmission(
        assignment_id=data.assignment_id,
        student_id=student.id,
        submission_text=data.submission_text,
        status="submitted",
    )

    db.add(submission)
    db.commit()
    db.refresh(submission)
    student = db.query(Student).filter(
    Student.id == submission.student_id,
    Student.is_active == True,
    ).first()

    if student:
        student_user = db.query(User).filter(
        User.email == student.email,
        User.is_active == True,
    ).first()

    if student_user:
        create_notification(
            db=db,
            user_id=student_user.id,
            title="Assignment Graded",
            message=(
                f"Your assignment '{assignment.title}' has been graded. "
                f"Marks: {submission.marks_obtained}/{assignment.max_marks}."
            ),
            type="assignment_graded",
        )

    return submission
@router.get(
    "/assignment/{assignment_id}",
    response_model=list[AssignmentSubmissionResponse],
)
def get_assignment_submissions(
    assignment_id: int,
    current_user: User = Depends(require_role("teacher")),
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

    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.is_active == True,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    if assignment.teacher_id != teacher.id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view these submissions",
        )

    submissions = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id
    ).order_by(
        AssignmentSubmission.submitted_at.asc()
    ).all()

    return submissions
@router.put(
    "/{submission_id}",
    response_model=AssignmentSubmissionResponse,
)
def grade_assignment_submission(
    submission_id: int,
    data: AssignmentSubmissionUpdate,
    current_user: User = Depends(require_role("teacher")),
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

    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(
            status_code=404,
            detail="Submission not found",
        )

    assignment = db.query(Assignment).filter(
        Assignment.id == submission.assignment_id,
        Assignment.is_active == True,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    if assignment.teacher_id != teacher.id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to grade this submission",
        )

    if data.marks_obtained < 0:
        raise HTTPException(
            status_code=400,
            detail="Marks cannot be negative",
        )

    if data.marks_obtained > assignment.max_marks:
        raise HTTPException(
            status_code=400,
            detail="Marks cannot exceed assignment max marks",
        )

    submission.marks_obtained = data.marks_obtained
    submission.feedback = data.feedback
    submission.status = "graded"

    db.commit()
    db.refresh(submission)

    return submission
@router.get(
    "/me/{assignment_id}",
    response_model=AssignmentSubmissionResponse,
)
def get_my_submission(
    assignment_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(
        Student.email == current_user.email,
        Student.is_active == True,
    ).first()

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found",
        )

    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.student_id == student.id,
    ).first()

    if not submission:
        raise HTTPException(
            status_code=404,
            detail="Submission not found",
        )

    return submission
@router.get(
    "/me/children/{student_id}/{assignment_id}",
    response_model=AssignmentSubmissionResponse,
)
def get_my_child_submission(
    student_id: int,
    assignment_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = db.query(Parent).filter(
        Parent.user_id == current_user.id,
        Parent.is_active == True,
    ).first()

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found",
        )

    parent_child = db.query(ParentChild).filter(
        ParentChild.parent_id == parent.id,
        ParentChild.student_id == student_id,
    ).first()

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's submission",
        )

    submission = db.query(AssignmentSubmission).filter(
        AssignmentSubmission.assignment_id == assignment_id,
        AssignmentSubmission.student_id == student_id,
    ).first()

    if not submission:
        raise HTTPException(
            status_code=404,
            detail="Submission not found",
        )

    return submission