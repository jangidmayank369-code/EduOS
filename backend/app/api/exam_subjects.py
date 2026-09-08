from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import (
    Exam,
    ExamSubject,
    SchoolClass,
    Subject,
    ClassSubject,
    User,
)
from app.schemas.exam_subject import (
    ExamSubjectCreate,
    ExamSubjectResponse,
)

router = APIRouter(
    prefix="/exam-subjects",
    tags=["Exam Subjects"]
)


@router.post(
    "/",
    response_model=ExamSubjectResponse
)
def add_exam_subject(
    data: ExamSubjectCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
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

    class_subject = (
        db.query(ClassSubject)
        .filter(
            ClassSubject.class_id == data.class_id,
            ClassSubject.subject_id == data.subject_id
        )
        .first()
    )

    if not class_subject:
        raise HTTPException(
            status_code=400,
            detail="Subject is not assigned to this class"
        )

    existing = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == data.exam_id,
            ExamSubject.class_id == data.class_id,
            ExamSubject.subject_id == data.subject_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Subject already added to this exam for this class"
        )

    exam_subject = ExamSubject(
        exam_id=data.exam_id,
        class_id=data.class_id,
        subject_id=data.subject_id,
    )

    db.add(exam_subject)
    db.commit()
    db.refresh(exam_subject)

    return exam_subject