from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db

from app.models import (
    Parent,
    ParentChild,
    User,
    Attendance,
    Mark,
    Fee,
)

from app.schemas.parent import (
    ParentCreate,
    ParentUpdate,
    ParentResponse,
)

from app.schemas.parent_child import ParentChildResponse
from app.api.results import build_result_response
from app.schemas.fee import FeeSummaryResponse


router = APIRouter(
    prefix="/parents",
    tags=["Parents"],
)


# ============================================================
# ADMIN - CREATE PARENT
# POST /parents/
# ============================================================

@router.post(
    "/",
    response_model=ParentResponse,
)
def create_parent(
    data: ParentCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(
            User.id == data.user_id,
            User.is_active.is_(True),
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.role != "parent":
        raise HTTPException(
            status_code=400,
            detail="User role must be parent",
        )

    existing_parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == data.user_id,
        )
        .first()
    )

    if existing_parent:
        raise HTTPException(
            status_code=400,
            detail="Parent profile already exists",
        )

    parent = Parent(
        user_id=data.user_id,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
    )

    db.add(parent)
    db.commit()
    db.refresh(parent)

    return parent


# ============================================================
# ADMIN - GET ALL PARENTS
# GET /parents/
# ============================================================

@router.get(
    "/",
    response_model=list[ParentResponse],
)
def get_parents(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    parents = (
        db.query(Parent)
        .filter(
            Parent.is_active.is_(True),
        )
        .all()
    )

    return parents


# ============================================================
# ADMIN - GET SINGLE PARENT
# GET /parents/{parent_id}
# ============================================================

@router.get(
    "/{parent_id}",
    response_model=ParentResponse,
)
def get_parent(
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

    return parent


# ============================================================
# ADMIN - UPDATE PARENT
# PUT /parents/{parent_id}
# ============================================================

@router.put(
    "/{parent_id}",
    response_model=ParentResponse,
)
def update_parent(
    parent_id: int,
    data: ParentUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.id == parent_id,
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent not found",
        )

    if data.first_name is not None:
        parent.first_name = data.first_name

    if data.last_name is not None:
        parent.last_name = data.last_name

    if data.phone is not None:
        parent.phone = data.phone

    if data.is_active is not None:
        parent.is_active = data.is_active

    db.commit()
    db.refresh(parent)

    return parent


# ============================================================
# ADMIN - DELETE PARENT
# DELETE /parents/{parent_id}
# ============================================================

@router.delete(
    "/{parent_id}",
)
def delete_parent(
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

    # Soft delete
    parent.is_active = False

    db.commit()

    return {
        "message": "Parent deleted successfully",
    }


# ============================================================
# PARENT PORTAL - MY CHILDREN
# GET /parents/me/children
# ============================================================

@router.get(
    "/me/children",
    response_model=list[ParentChildResponse],
)
def get_my_children(
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == current_user.id,
            Parent.is_active.is_(True),
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found",
        )

    parent_children = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
        )
        .all()
    )

    return parent_children


# ============================================================
# PARENT PORTAL - CHILD ATTENDANCE
# GET /parents/me/children/{student_id}/attendance
# ============================================================

@router.get(
    "/me/children/{student_id}/attendance",
)
def get_my_child_attendance(
    student_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == current_user.id,
            Parent.is_active.is_(True),
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found",
        )

    parent_child = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
            ParentChild.student_id == student_id,
        )
        .first()
    )

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's attendance",
        )

    attendance = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student_id,
        )
        .all()
    )

    return attendance


# ============================================================
# PARENT PORTAL - CHILD MARKS
# GET /parents/me/children/{student_id}/marks
# ============================================================

@router.get(
    "/me/children/{student_id}/marks",
)
def get_my_child_marks(
    student_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == current_user.id,
            Parent.is_active.is_(True),
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found",
        )

    parent_child = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
            ParentChild.student_id == student_id,
        )
        .first()
    )

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's marks",
        )

    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student_id,
        )
        .all()
    )

    return marks


# ============================================================
# PARENT PORTAL - CHILD RESULT
# GET /parents/me/children/{student_id}/results/{exam_id}
# ============================================================

@router.get(
    "/me/children/{student_id}/results/{exam_id}",
)
def get_my_child_result(
    student_id: int,
    exam_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == current_user.id,
            Parent.is_active.is_(True),
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found",
        )

    parent_child = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
            ParentChild.student_id == student_id,
        )
        .first()
    )

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's result",
        )

    return build_result_response(
        db=db,
        student_id=student_id,
        exam_id=exam_id,
    )


# ============================================================
# PARENT PORTAL - CHILD FEE SUMMARY
# GET /parents/me/children/{student_id}/fees/summary
# ============================================================

@router.get(
    "/me/children/{student_id}/fees/summary",
    response_model=FeeSummaryResponse,
)
def get_my_child_fee_summary(
    student_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == current_user.id,
            Parent.is_active.is_(True),
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found",
        )

    parent_child = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
            ParentChild.student_id == student_id,
        )
        .first()
    )

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's fees",
        )

    fees = (
        db.query(Fee)
        .filter(
            Fee.student_id == student_id,
        )
        .all()
    )

    total_due = sum(
        fee.amount_due
        for fee in fees
    )

    total_paid = sum(
        fee.amount_paid
        for fee in fees
    )

    total_pending = total_due - total_paid

    return {
        "student_id": student_id,
        "total_due": total_due,
        "total_paid": total_paid,
        "total_pending": total_pending,
    }