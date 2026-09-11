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
    ExamSubjectUpdate,
    ExamSubjectResponse,
)

router = APIRouter(
    prefix="/exam-subjects",
    tags=["Exam Subjects"],
)


def validate_components(
    components,
    subject_max_marks: float,
) -> None:
    """
    Validate component configuration against the subject marks.
    """

    if not components:
        return

    total_component_marks = 0.0
    keys: set[str] = set()

    for component in components:
        key = component.key.strip().lower()

        if not key:
            raise HTTPException(
                status_code=400,
                detail="Component key cannot be empty.",
            )

        if key in keys:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate component key: {component.key}",
            )

        keys.add(key)

        if component.max_marks <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Component '{component.name}' must have "
                    "max marks greater than zero."
                ),
            )

        if component.pass_marks < 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Component '{component.name}' cannot have "
                    "negative pass marks."
                ),
            )

        if component.pass_marks > component.max_marks:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Component '{component.name}' pass marks "
                    "cannot be greater than max marks."
                ),
            )

        total_component_marks += component.max_marks

    if abs(total_component_marks - subject_max_marks) > 0.001:
        raise HTTPException(
            status_code=400,
            detail=(
                "Total component max marks must equal subject max marks. "
                f"Subject max marks: {subject_max_marks}, "
                f"component total: {total_component_marks}."
            ),
        )


@router.post(
    "/",
    response_model=ExamSubjectResponse,
)
def add_exam_subject(
    data: ExamSubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
):
    if data.pass_marks > data.max_marks:
        raise HTTPException(
            status_code=400,
            detail="Pass marks cannot be greater than max marks.",
        )

    exam = (
        db.query(Exam)
        .filter(
            Exam.id == data.exam_id,
            Exam.is_active == True,
        )
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found.",
        )

    if exam.status in {"LOCKED", "PUBLISHED"}:
        raise HTTPException(
            status_code=400,
            detail="This exam is locked and cannot be modified.",
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
            detail="Class not found.",
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
            detail="Subject not found.",
        )

    class_subject = (
        db.query(ClassSubject)
        .filter(
            ClassSubject.class_id == data.class_id,
            ClassSubject.subject_id == data.subject_id,
        )
        .first()
    )

    if not class_subject:
        raise HTTPException(
            status_code=400,
            detail="This subject is not assigned to the selected class.",
        )

    existing = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == data.exam_id,
            ExamSubject.class_id == data.class_id,
            ExamSubject.subject_id == data.subject_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="This subject is already configured for the exam.",
        )

    validate_components(
        data.components,
        data.max_marks,
    )

    exam_subject = ExamSubject(
        exam_id=data.exam_id,
        class_id=data.class_id,
        subject_id=data.subject_id,
        max_marks=data.max_marks,
        pass_marks=data.pass_marks,
        is_optional=data.is_optional,
        include_in_result=data.include_in_result,
        components=[
            component.model_dump()
            for component in data.components
        ],
    )

    db.add(exam_subject)
    db.commit()
    db.refresh(exam_subject)

    return exam_subject


@router.get(
    "/exam/{exam_id}",
    response_model=list[ExamSubjectResponse],
)
def get_exam_subjects(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
):
    exam = (
        db.query(Exam)
        .filter(Exam.id == exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found.",
        )

    return (
        db.query(ExamSubject)
        .filter(ExamSubject.exam_id == exam_id)
        .order_by(
            ExamSubject.class_id,
            ExamSubject.subject_id,
        )
        .all()
    )


@router.get(
    "/{exam_id}/{class_id}/{subject_id}",
    response_model=ExamSubjectResponse,
)
def get_exam_subject(
    exam_id: int,
    class_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
):
    exam_subject = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == exam_id,
            ExamSubject.class_id == class_id,
            ExamSubject.subject_id == subject_id,
        )
        .first()
    )

    if not exam_subject:
        raise HTTPException(
            status_code=404,
            detail="Exam subject configuration not found.",
        )

    return exam_subject


@router.put(
    "/{exam_id}/{class_id}/{subject_id}",
    response_model=ExamSubjectResponse,
)
def update_exam_subject(
    exam_id: int,
    class_id: int,
    subject_id: int,
    data: ExamSubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
):
    exam_subject = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == exam_id,
            ExamSubject.class_id == class_id,
            ExamSubject.subject_id == subject_id,
        )
        .first()
    )

    if not exam_subject:
        raise HTTPException(
            status_code=404,
            detail="Exam subject configuration not found.",
        )

    exam = (
        db.query(Exam)
        .filter(Exam.id == exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found.",
        )

    if exam.status in {"LOCKED", "PUBLISHED"}:
        raise HTTPException(
            status_code=400,
            detail="This exam is locked and cannot be modified.",
        )

    new_max_marks = (
        data.max_marks
        if data.max_marks is not None
        else exam_subject.max_marks
    )

    new_pass_marks = (
        data.pass_marks
        if data.pass_marks is not None
        else exam_subject.pass_marks
    )

    if new_pass_marks > new_max_marks:
        raise HTTPException(
            status_code=400,
            detail="Pass marks cannot be greater than max marks.",
        )

    if data.components is not None:
        validate_components(
            data.components,
            new_max_marks,
        )

    exam_subject.max_marks = new_max_marks
    exam_subject.pass_marks = new_pass_marks

    if data.is_optional is not None:
        exam_subject.is_optional = data.is_optional

    if data.include_in_result is not None:
        exam_subject.include_in_result = data.include_in_result

    if data.components is not None:
        exam_subject.components = [
            component.model_dump()
            for component in data.components
        ]

    db.commit()
    db.refresh(exam_subject)

    return exam_subject


@router.delete(
    "/{exam_id}/{class_id}/{subject_id}",
)
def delete_exam_subject(
    exam_id: int,
    class_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "TEACHER")),
):
    exam_subject = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == exam_id,
            ExamSubject.class_id == class_id,
            ExamSubject.subject_id == subject_id,
        )
        .first()
    )

    if not exam_subject:
        raise HTTPException(
            status_code=404,
            detail="Exam subject configuration not found.",
        )

    exam = (
        db.query(Exam)
        .filter(Exam.id == exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found.",
        )

    if exam.status in {"LOCKED", "PUBLISHED"}:
        raise HTTPException(
            status_code=400,
            detail="This exam is locked and cannot be modified.",
        )

    db.delete(exam_subject)
    db.commit()

    return {
        "message": "Exam subject configuration deleted successfully."
    }