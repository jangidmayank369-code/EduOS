from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Parent, ParentChild, Student, User
from app.schemas.parent_child import (
    ParentChildCreate,
    ParentChildResponse,
)

router = APIRouter(
    prefix="/parent-children",
    tags=["Parent Children"]
)


@router.post(
    "/",
    response_model=ParentChildResponse
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
            Parent.is_active == True
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent not found"
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

    existing = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == data.parent_id,
            ParentChild.student_id == data.student_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Parent-child relationship already exists"
        )

    parent_child = ParentChild(
        parent_id=data.parent_id,
        student_id=data.student_id
    )

    db.add(parent_child)
    db.commit()
    db.refresh(parent_child)

    return parent_child


@router.get(
    "/parent/{parent_id}",
    response_model=list[ParentChildResponse]
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
            Parent.is_active == True
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent not found"
        )

    relationships = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent_id
        )
        .all()
    )

    return relationships


@router.delete(
    "/{parent_id}/{student_id}"
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
            ParentChild.student_id == student_id
        )
        .first()
    )

    if not relationship:
        raise HTTPException(
            status_code=404,
            detail="Parent-child relationship not found"
        )

    db.delete(relationship)
    db.commit()

    return {
        "message": "Parent-child relationship deleted successfully"
    }