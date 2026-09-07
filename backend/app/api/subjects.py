from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Subject
from app.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate
router = APIRouter(
    prefix="/subjects",
    tags=["Subjects"]
)
@router.post("/", response_model=SubjectResponse)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    existing_subject = db.query(Subject).filter(
        (Subject.name == data.name) | (Subject.code == data.code)
    ).first()

    if existing_subject:
        raise HTTPException(
            status_code=400,
            detail="Subject name or code already exists"
        )

    new_subject = Subject(
        name=data.name,
        code=data.code,
        description=data.description,
    )

    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)

    return new_subject
@router.get("/", response_model=list[SubjectResponse])
def get_subjects(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    subjects = db.query(Subject).filter(
        Subject.is_active == True
    ).all()

    return subjects
@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found"
        )

    return subject
@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found"
        )

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)

    return subject
@router.delete("/{subject_id}", response_model=SubjectResponse)
def deactivate_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found"
        )

    subject.is_active = False

    db.commit()
    db.refresh(subject)

    return subject
