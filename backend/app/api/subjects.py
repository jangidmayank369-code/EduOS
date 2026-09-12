from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Subject
from app.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate

router = APIRouter(
    prefix="/subjects",
    tags=["Subjects"],
)


@router.post("/", response_model=SubjectResponse)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    name = data.name.strip()
    code = data.code.strip().upper()

    if not name:
        raise HTTPException(status_code=400, detail="Subject name is required.")
    if not code:
        raise HTTPException(status_code=400, detail="Subject code is required.")

    existing_subject = (
        db.query(Subject)
        .filter((Subject.name == name) | (Subject.code == code))
        .first()
    )

    if existing_subject:
        raise HTTPException(
            status_code=400,
            detail="Subject name or code already exists.",
        )

    new_subject = Subject(
        name=name,
        code=code,
        description=data.description.strip() if data.description else None,
    )

    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)

    return new_subject


@router.get("/", response_model=list[SubjectResponse])
def get_subjects(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    return (
        db.query(Subject)
        .filter(Subject.is_active == True)
        .order_by(Subject.name.asc())
        .all()
    )


@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id)
        .first()
    )

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    return subject


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id)
        .first()
    )

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()
        if not update_data["name"]:
            raise HTTPException(
                status_code=400,
                detail="Subject name cannot be empty.",
            )

    if "code" in update_data:
        update_data["code"] = update_data["code"].strip().upper()
        if not update_data["code"]:
            raise HTTPException(
                status_code=400,
                detail="Subject code cannot be empty.",
            )

    if "description" in update_data and update_data["description"]:
        update_data["description"] = update_data["description"].strip()

    duplicate_filters = []

    if "name" in update_data:
        duplicate_filters.append(Subject.name == update_data["name"])

    if "code" in update_data:
        duplicate_filters.append(Subject.code == update_data["code"])

    if duplicate_filters:
        duplicate = (
            db.query(Subject)
            .filter(
                Subject.id != subject_id,
                *duplicate_filters,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Another subject already uses this name or code.",
            )

    for field, value in update_data.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)

    return subject


@router.delete("/{subject_id}", response_model=SubjectResponse)
def deactivate_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id)
        .first()
    )

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    subject.is_active = False

    db.commit()
    db.refresh(subject)

    return subject
