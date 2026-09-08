from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Exam, User
from app.schemas.exam import ExamCreate, ExamUpdate, ExamResponse

router = APIRouter(
    prefix="/exams",
    tags=["Exams"]
)


@router.post(
    "/",
    response_model=ExamResponse
)
def create_exam(
    data: ExamCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    exam = Exam(
        name=data.name,
        description=data.description,
    )

    db.add(exam)
    db.commit()
    db.refresh(exam)

    return exam


@router.get(
    "/",
    response_model=list[ExamResponse]
)
def get_exams(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    exams = (
        db.query(Exam)
        .filter(Exam.is_active == True)
        .order_by(Exam.id)
        .all()
    )

    return exams


@router.get(
    "/{exam_id}",
    response_model=ExamResponse
)
def get_exam(
    exam_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
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

    return exam


@router.put(
    "/{exam_id}",
    response_model=ExamResponse
)
def update_exam(
    exam_id: int,
    data: ExamUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
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

    if data.name is not None:
        exam.name = data.name

    if data.description is not None:
        exam.description = data.description

    if data.is_active is not None:
        exam.is_active = data.is_active

    db.commit()
    db.refresh(exam)

    return exam


@router.delete(
    "/{exam_id}"
)
def delete_exam(
    exam_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
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

    exam.is_active = False

    db.commit()

    return {
        "message": "Exam deleted successfully"
    }