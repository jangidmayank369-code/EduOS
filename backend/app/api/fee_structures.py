from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models.academic_session import AcademicSession
from app.models.fee_structure import FeeStructure
from app.models.school_class import SchoolClass
from app.models.user import User
from app.schemas.fee_structure import (
    FeeStructureCreate,
    FeeStructureResponse,
    FeeStructureUpdate,
)


router = APIRouter(
    prefix="/fee-structures",
    tags=["Fee Structures"],
)


@router.post(
    "/",
    response_model=FeeStructureResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_fee_structure(
    data: FeeStructureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    academic_session = (
        db.query(AcademicSession)
        .filter(AcademicSession.id == data.academic_session_id)
        .first()
    )

    if not academic_session:
        raise HTTPException(
            status_code=404,
            detail="Academic session not found",
        )

    school_class = (
        db.query(SchoolClass)
        .filter(SchoolClass.id == data.class_id)
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found",
        )

    if hasattr(school_class, "is_active") and not school_class.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot create fee structure for an inactive class",
        )

    existing = (
        db.query(FeeStructure)
        .filter(
            FeeStructure.academic_session_id
            == data.academic_session_id,
            FeeStructure.class_id == data.class_id,
            FeeStructure.name == data.name,
            FeeStructure.is_active.is_(True),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "An active fee structure with the same name "
                "already exists for this class and academic session."
            ),
        )

    fee_structure = FeeStructure(
        academic_session_id=data.academic_session_id,
        class_id=data.class_id,
        name=data.name.strip(),
        description=data.description,
        amount=data.amount,
        frequency=data.frequency.upper(),
        due_day=data.due_day,
        is_active=True,
    )

    db.add(fee_structure)
    db.commit()
    db.refresh(fee_structure)

    return fee_structure


@router.get(
    "/",
    response_model=list[FeeStructureResponse],
)
def get_fee_structures(
    academic_session_id: int | None = Query(default=None, gt=0),
    class_id: int | None = Query(default=None, gt=0),
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = db.query(FeeStructure)

    if academic_session_id is not None:
        query = query.filter(
            FeeStructure.academic_session_id
            == academic_session_id
        )

    if class_id is not None:
        query = query.filter(
            FeeStructure.class_id == class_id
        )

    if active_only:
        query = query.filter(
            FeeStructure.is_active.is_(True)
        )

    return query.order_by(
        FeeStructure.created_at.desc()
    ).all()


@router.get(
    "/{fee_structure_id}",
    response_model=FeeStructureResponse,
)
def get_fee_structure(
    fee_structure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    fee_structure = (
        db.query(FeeStructure)
        .filter(FeeStructure.id == fee_structure_id)
        .first()
    )

    if not fee_structure:
        raise HTTPException(
            status_code=404,
            detail="Fee structure not found",
        )

    return fee_structure


@router.put(
    "/{fee_structure_id}",
    response_model=FeeStructureResponse,
)
def update_fee_structure(
    fee_structure_id: int,
    data: FeeStructureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    fee_structure = (
        db.query(FeeStructure)
        .filter(FeeStructure.id == fee_structure_id)
        .first()
    )

    if not fee_structure:
        raise HTTPException(
            status_code=404,
            detail="Fee structure not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    academic_session_id = update_data.get(
        "academic_session_id",
        fee_structure.academic_session_id,
    )

    class_id = update_data.get(
        "class_id",
        fee_structure.class_id,
    )

    if (
        "academic_session_id" in update_data
        or "class_id" in update_data
    ):
        academic_session = (
            db.query(AcademicSession)
            .filter(
                AcademicSession.id == academic_session_id
            )
            .first()
        )

        if not academic_session:
            raise HTTPException(
                status_code=404,
                detail="Academic session not found",
            )

        school_class = (
            db.query(SchoolClass)
            .filter(SchoolClass.id == class_id)
            .first()
        )

        if not school_class:
            raise HTTPException(
                status_code=404,
                detail="Class not found",
            )

        if (
            hasattr(school_class, "is_active")
            and not school_class.is_active
        ):
            raise HTTPException(
                status_code=400,
                detail="Cannot use an inactive class",
            )

    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()

    if "frequency" in update_data:
        update_data["frequency"] = (
            update_data["frequency"].upper()
        )

    duplicate_name = update_data.get(
        "name",
        fee_structure.name,
    )

    duplicate = (
        db.query(FeeStructure)
        .filter(
            FeeStructure.id != fee_structure.id,
            FeeStructure.academic_session_id
            == academic_session_id,
            FeeStructure.class_id == class_id,
            FeeStructure.name == duplicate_name,
            FeeStructure.is_active.is_(True),
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail=(
                "An active fee structure with the same name "
                "already exists for this class and academic session."
            ),
        )

    for field, value in update_data.items():
        setattr(fee_structure, field, value)

    db.commit()
    db.refresh(fee_structure)

    return fee_structure


@router.delete(
    "/{fee_structure_id}",
    response_model=FeeStructureResponse,
)
def deactivate_fee_structure(
    fee_structure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    fee_structure = (
        db.query(FeeStructure)
        .filter(FeeStructure.id == fee_structure_id)
        .first()
    )

    if not fee_structure:
        raise HTTPException(
            status_code=404,
            detail="Fee structure not found",
        )

    if not fee_structure.is_active:
        raise HTTPException(
            status_code=400,
            detail="Fee structure is already inactive",
        )

    fee_structure.is_active = False

    db.commit()
    db.refresh(fee_structure)

    return fee_structure
