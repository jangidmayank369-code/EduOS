from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import SchoolClass
from app.schemas.school_class import ClassCreate, ClassResponse, ClassUpdate
from app.models import Subject, ClassSubject

router = APIRouter(
    prefix="/classes",
    tags=["Classes"],
)


@router.post("/", response_model=ClassResponse)
def create_class(
    data: ClassCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing_class = (
        db.query(SchoolClass)
        .filter(SchoolClass.name == data.name)
        .first()
    )

    if existing_class:
        raise HTTPException(
            status_code=400,
            detail="Class already exists"
        )

    new_class = SchoolClass(
        name=data.name,
        description=data.description,
    )

    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    return new_class
@router.get("/", response_model=list[ClassResponse])
def get_classes(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    classes = (
        db.query(SchoolClass)
        .filter(SchoolClass.is_active == True)
        .all()
    )

    return classes
@router.get("/{class_id}", response_model=ClassResponse)
def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    school_class = (
        db.query(SchoolClass)
        .filter(SchoolClass.id == class_id)
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    return school_class
@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: int,
    data: ClassUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()

    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(school_class, field, value)

    db.commit()
    db.refresh(school_class)

    return school_class
@router.delete("/{class_id}", response_model=ClassResponse)
def deactivate_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id
    ).first()

    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")

    school_class.is_active = False

    db.commit()
    db.refresh(school_class)

    return school_class
@router.post("/{class_id}/subjects/{subject_id}")
def assign_subject_to_class(
    class_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id,
        SchoolClass.is_active == True
    ).first()

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found or inactive"
        )

    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.is_active == True
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found or inactive"
        )

    existing_assignment = db.query(ClassSubject).filter(
        ClassSubject.class_id == class_id,
        ClassSubject.subject_id == subject_id
    ).first()

    if existing_assignment:
        raise HTTPException(
            status_code=400,
            detail="Subject is already assigned to this class"
        )

    assignment = ClassSubject(
        class_id=class_id,
        subject_id=subject_id
    )

    db.add(assignment)
    db.commit()

    return {
        "message": "Subject assigned to class successfully",
        "class_id": class_id,
        "subject_id": subject_id
    }
@router.get("/{class_id}/subjects")
def get_class_subjects(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id,
        SchoolClass.is_active == True
    ).first()

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found or inactive"
        )

    assignments = db.query(ClassSubject).filter(
        ClassSubject.class_id == class_id
    ).all()

    return [
        {
            "id": assignment.subject.id,
            "name": assignment.subject.name,
            "code": assignment.subject.code,
            "description": assignment.subject.description,
        }
        for assignment in assignments
    ]
@router.delete("/{class_id}/subjects/{subject_id}")
def remove_subject_from_class(
    class_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin"))
):
    assignment = db.query(ClassSubject).filter(
        ClassSubject.class_id == class_id,
        ClassSubject.subject_id == subject_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Subject is not assigned to this class"
        )

    db.delete(assignment)
    db.commit()

    return {
        "message": "Subject removed from class successfully",
        "class_id": class_id,
        "subject_id": subject_id
    }
