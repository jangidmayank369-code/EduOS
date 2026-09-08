from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Fee, Student, Parent, ParentChild, User
from app.schemas.fee import FeeCreate, FeeUpdate, FeeResponse
from app.services.notification_service import create_notification
router = APIRouter(prefix="/fees", tags=["Fees"])


@router.post("/", response_model=FeeResponse)
def create_fee(
    data: FeeCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
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

    if data.amount_due <= 0:
        raise HTTPException(
            status_code=400,
            detail="Amount due must be greater than 0"
        )

    fee = Fee(
        student_id=data.student_id,
        title=data.title,
        amount_due=data.amount_due,
        amount_paid=0,
        status="pending",
    )

    db.add(fee)
    db.commit()
    db.refresh(fee)

    return fee
@router.get("/", response_model=list[FeeResponse])
def get_fees(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    fees = (
        db.query(Fee)
        .filter(Fee.status != "cancelled")
        .order_by(Fee.created_at.desc())
        .all()
    )

    return fees
@router.put("/{fee_id}", response_model=FeeResponse)
def update_fee(
    fee_id: int,
    data: FeeUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    fee = db.query(Fee).filter(Fee.id == fee_id).first()

    if not fee:
        raise HTTPException(
            status_code=404,
            detail="Fee not found"
        )

    if data.title is not None:
        fee.title = data.title

    if data.amount_due is not None:
        if data.amount_due <= 0:
            raise HTTPException(
                status_code=400,
                detail="Amount due must be greater than 0"
            )
        fee.amount_due = data.amount_due

    if data.amount_paid is not None:
        if data.amount_paid < 0:
            raise HTTPException(
                status_code=400,
                detail="Amount paid cannot be negative"
            )

        if data.amount_paid > fee.amount_due:
            raise HTTPException(
                status_code=400,
                detail="Amount paid cannot exceed amount due"
            )

        fee.amount_paid = data.amount_paid

        if fee.amount_paid == 0:
            fee.status = "pending"
        elif fee.amount_paid < fee.amount_due:
            fee.status = "partial"
        else:
            fee.status = "paid"

    if data.status is not None:
        fee.status = data.status
    db.commit()
    db.refresh(fee)

    student = db.query(Student).filter(
        Student.id == fee.student_id,
        Student.is_active == True,
    ).first()

    if student:
        parent_links = db.query(ParentChild).filter(
            ParentChild.student_id == student.id
    ).all()

    for parent_link in parent_links:
        parent = db.query(Parent).filter(
            Parent.id == parent_link.parent_id,
            Parent.is_active == True,
        ).first()

        if parent:
            parent_user = db.query(User).filter(
                User.id == parent.user_id,
                User.is_active == True,
            ).first()

            if parent_user:
                create_notification(
                    db=db,
                    user_id=parent_user.id,
                    title="Fee Updated",
                    message=(
                        f'Fee "{fee.title}" has been updated. '
                        f"Paid: ₹{fee.amount_paid} / ₹{fee.amount_due}. "
                        f"Status: {fee.status}."
                    ),
                    type="fee_updated",
                )

        return fee
@router.get("/me/children/{student_id}/fees")
def get_my_child_fees(
    student_id: int,
    current_user: User = Depends(require_role("parent")),
    db: Session = Depends(get_db),
):
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == current_user.id,
            Parent.is_active == True
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found"
        )

    parent_child = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
            ParentChild.student_id == student_id
        )
        .first()
    )

    if not parent_child:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this student's fees"
        )

    fees = (
        db.query(Fee)
        .filter(Fee.student_id == student_id)
        .order_by(Fee.created_at.desc())
        .all()
    )

    return fees