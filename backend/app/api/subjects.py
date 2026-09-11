from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Subject
from app.models.co_scholastic import CoScholasticComponent
from app.schemas.subject import SubjectCreate, SubjectResponse, SubjectUpdate
from app.schemas.co_scholastic import (
    CoScholasticComponentCreate,
    CoScholasticComponentResponse,
    CoScholasticComponentUpdate,
)

router = APIRouter(
    prefix="/subjects",
    tags=["Subjects"],
)


# ============================================================
# SUBJECT CRUD
# ============================================================

@router.post("/", response_model=SubjectResponse)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing_subject = db.query(Subject).filter(
        (Subject.name == data.name) | (Subject.code == data.code)
    ).first()

    if existing_subject:
        raise HTTPException(
            status_code=400,
            detail="Subject name or code already exists",
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
    current_user=Depends(require_role("admin")),
):
    subjects = db.query(Subject).filter(
        Subject.is_active == True
    ).all()

    return subjects


# ============================================================
# SUBJECT → CO-SCHOLASTIC
# ============================================================

@router.get(
    "/{subject_id}/co-scholastic/components",
    response_model=list[CoScholasticComponentResponse],
)
def get_subject_co_scholastic_components(
    subject_id: int,
    class_id: int = Query(..., description="Class ID"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """
    Subject ke andar Co-Scholastic configuration load karega.

    NOTE:
    Co-Scholastic component abhi class-based hai.
    subject_id UI/context ke liye validate kiya ja raha hai.
    """

    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    components = (
        db.query(CoScholasticComponent)
        .filter(
            CoScholasticComponent.class_id == class_id,
            CoScholasticComponent.is_active == True,
        )
        .order_by(
            CoScholasticComponent.display_order.asc(),
            CoScholasticComponent.id.asc(),
        )
        .all()
    )

    return components


@router.post(
    "/{subject_id}/co-scholastic/components",
    response_model=CoScholasticComponentResponse,
)
def create_subject_co_scholastic_component(
    subject_id: int,
    data: CoScholasticComponentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """
    Subject page ke andar se Co-Scholastic component create karega.

    Component actual DB me class-based rahega.
    """

    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    existing_component = (
        db.query(CoScholasticComponent)
        .filter(
            CoScholasticComponent.class_id == data.class_id,
            CoScholasticComponent.name == data.name,
            CoScholasticComponent.is_active == True,
        )
        .first()
    )

    if existing_component:
        raise HTTPException(
            status_code=400,
            detail="Co-Scholastic component with this name already exists for this class",
        )

    component = CoScholasticComponent(
        class_id=data.class_id,
        name=data.name,
        component_type=data.component_type,
        max_marks=data.max_marks,
        include_in_result=data.include_in_result,
        display_order=data.display_order,
        is_active=True,
    )

    db.add(component)
    db.commit()
    db.refresh(component)

    return component


@router.put(
    "/{subject_id}/co-scholastic/components/{component_id}",
    response_model=CoScholasticComponentResponse,
)
def update_subject_co_scholastic_component(
    subject_id: int,
    component_id: int,
    data: CoScholasticComponentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    component = db.query(CoScholasticComponent).filter(
        CoScholasticComponent.id == component_id
    ).first()

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-Scholastic component not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        duplicate = (
            db.query(CoScholasticComponent)
            .filter(
                CoScholasticComponent.class_id == component.class_id,
                CoScholasticComponent.name == update_data["name"],
                CoScholasticComponent.id != component.id,
                CoScholasticComponent.is_active == True,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Co-Scholastic component with this name already exists for this class",
            )

    for field, value in update_data.items():
        setattr(component, field, value)

    db.commit()
    db.refresh(component)

    return component


@router.delete(
    "/{subject_id}/co-scholastic/components/{component_id}",
    response_model=CoScholasticComponentResponse,
)
def deactivate_subject_co_scholastic_component(
    subject_id: int,
    component_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    component = db.query(CoScholasticComponent).filter(
        CoScholasticComponent.id == component_id
    ).first()

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-Scholastic component not found",
        )

    component.is_active = False

    db.commit()
    db.refresh(component)

    return component


# ============================================================
# SUBJECT DETAIL
# ============================================================

@router.get("/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    return subject


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
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
    current_user=Depends(require_role("admin")),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id
    ).first()

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    subject.is_active = False

    db.commit()
    db.refresh(subject)

    return subject