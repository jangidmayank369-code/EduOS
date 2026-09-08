from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Parent, ParentChild, Student, User
from app.schemas.parent_child import (
    ParentChildCreate,
    ParentChildResponse,
    ParentChildUpdate,
)

router = APIRouter(
    prefix="/parent-children",
    tags=["Parent Children"],
)


ALLOWED_RELATIONS = {
    "FATHER",
    "MOTHER",
    "GUARDIAN",
    "GRANDFATHER",
    "GRANDMOTHER",
    "OTHER",
}


@router.post(
    "/",
    response_model=ParentChildResponse,
)
def create_parent_child(
    data: ParentChildCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.id == data.parent_id,
            Parent.is_active.is_(True),
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent not found",
        )

    student = (
        db.query(Student)
        .filter(
            Student.id == data.student_id,
            Student.is_active.is_(True),
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    relation_type = data.relation_type.upper().strip()

    if relation_type not in ALLOWED_RELATIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid relation type. Allowed values: "
                "FATHER, MOTHER, GUARDIAN, GRANDFATHER, "
                "GRANDMOTHER, OTHER"
            ),
        )

    existing = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == data.parent_id,
            ParentChild.student_id == data.student_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Parent-child relationship already exists",
        )

    if data.is_primary:
        existing_primary = (
            db.query(ParentChild)
            .filter(
                ParentChild.student_id == data.student_id,
                ParentChild.is_primary.is_(True),
            )
            .first()
        )

        if existing_primary:
            existing_primary.is_primary = False

    parent_child = ParentChild(
        parent_id=data.parent_id,
        student_id=data.student_id,
        relation_type=relation_type,
        is_primary=data.is_primary,
        is_emergency_contact=data.is_emergency_contact,
        receives_notifications=data.receives_notifications,
    )

    db.add(parent_child)
    db.commit()
    db.refresh(parent_child)

    return parent_child


@router.get(
    "/parent/{parent_id}",
    response_model=list[ParentChildResponse],
)
def get_parent_children(
    parent_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.id == parent_id,
            Parent.is_active.is_(True),
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent not found",
        )

    relationships = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent_id,
        )
        .all()
    )

    return relationships


@router.put(
    "/{parent_id}/{student_id}",
    response_model=ParentChildResponse,
)
def update_parent_child(
    parent_id: int,
    student_id: int,
    data: ParentChildUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    relationship = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent_id,
            ParentChild.student_id == student_id,
        )
        .first()
    )

    if not relationship:
        raise HTTPException(
            status_code=404,
            detail="Parent-child relationship not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "relation_type" in update_data:
        relation_type = update_data["relation_type"].upper().strip()

        if relation_type not in ALLOWED_RELATIONS:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid relation type. Allowed values: "
                    "FATHER, MOTHER, GUARDIAN, GRANDFATHER, "
                    "GRANDMOTHER, OTHER"
                ),
            )

        update_data["relation_type"] = relation_type

    if update_data.get("is_primary") is True:
        existing_primary = (
            db.query(ParentChild)
            .filter(
                ParentChild.student_id == student_id,
                ParentChild.is_primary.is_(True),
                ParentChild.parent_id != parent_id,
            )
            .first()
        )

        if existing_primary:
            existing_primary.is_primary = False

    for field, value in update_data.items():
        setattr(relationship, field, value)

    db.commit()
    db.refresh(relationship)

    return relationship


@router.delete(
    "/{parent_id}/{student_id}",
)
def delete_parent_child(
    parent_id: int,
    student_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    relationship = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent_id,
            ParentChild.student_id == student_id,
        )
        .first()
    )

    if not relationship:
        raise HTTPException(
            status_code=404,
            detail="Parent-child relationship not found",
        )

    db.delete(relationship)
    db.commit()

    return {
        "message": "Parent-child relationship deleted successfully",
    }