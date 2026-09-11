from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import (
    Fee,
    FeePayment,
    Parent,
    ParentChild,
    SchoolClass,
    Student,
    User,
)
from app.schemas.fee_payment import (
    FeePaymentCreate,
    FeePaymentResponse,
    FeeReceiptResponse,
)

router = APIRouter(prefix="/fee-payments", tags=["Fee Payments"])


@router.post("/", response_model=FeePaymentResponse)
def create_fee_payment(
    data: FeePaymentCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    fee = (
        db.query(Fee)
        .filter(Fee.id == data.fee_id)
        .with_for_update()
        .first()
    )

    if not fee:
        raise HTTPException(
            status_code=404,
            detail="Fee not found",
        )

    if fee.status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Cannot make payment for a cancelled fee",
        )

    remaining_amount = fee.amount_due - fee.amount_paid

    if remaining_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="This fee is already fully paid",
        )

    if data.amount > remaining_amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Payment amount cannot exceed the remaining "
                f"amount of ₹{remaining_amount:.2f}"
            ),
        )

    payment = FeePayment(
        fee_id=fee.id,
        amount=data.amount,
        payment_method=data.payment_method.strip(),
        transaction_reference=(
            data.transaction_reference.strip()
            if data.transaction_reference
            else None
        ),
        receipt_number=(
            f"RCP-{datetime.utcnow():%Y%m%d%H%M%S}-"
            f"{uuid4().hex[:8].upper()}"
        ),
        remarks=data.remarks,
    )

    db.add(payment)

    fee.amount_paid += data.amount

    if fee.amount_paid <= 0:
        fee.status = "pending"

    elif fee.amount_paid < fee.amount_due:
        fee.status = "partial"

    else:
        fee.amount_paid = fee.amount_due
        fee.status = "paid"

    db.commit()
    db.refresh(payment)

    return payment


@router.get(
    "/fee/{fee_id}",
    response_model=list[FeePaymentResponse],
)
def get_fee_payments(
    fee_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    fee = (
        db.query(Fee)
        .filter(Fee.id == fee_id)
        .first()
    )

    if not fee:
        raise HTTPException(
            status_code=404,
            detail="Fee not found",
        )

    payments = (
        db.query(FeePayment)
        .filter(FeePayment.fee_id == fee_id)
        .order_by(FeePayment.payment_date.desc())
        .all()
    )

    return payments


@router.get(
    "/{payment_id}",
    response_model=FeePaymentResponse,
)
def get_fee_payment(
    payment_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    payment = (
        db.query(FeePayment)
        .filter(FeePayment.id == payment_id)
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found",
        )

    return payment


@router.get(
    "/{payment_id}/receipt",
    response_model=FeeReceiptResponse,
)
def get_fee_receipt(
    payment_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    payment = (
        db.query(FeePayment)
        .filter(FeePayment.id == payment_id)
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found",
        )

    fee = (
        db.query(Fee)
        .filter(Fee.id == payment.fee_id)
        .first()
    )

    if not fee:
        raise HTTPException(
            status_code=404,
            detail="Fee associated with this payment was not found",
        )

    student = (
        db.query(Student)
        .filter(Student.id == fee.student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student associated with this fee was not found",
        )

    school_class = None

    if student.class_id is not None:
        school_class = (
            db.query(SchoolClass)
            .filter(SchoolClass.id == student.class_id)
            .first()
        )

    student_name = (
        f"{student.first_name} {student.last_name}"
    ).strip()

    class_name = (
        school_class.name
        if school_class
        else None
    )

    # Amount that was paid before this particular transaction.
    previously_paid = max(
        float(fee.amount_paid) - float(payment.amount),
        0,
    )

    total_amount = float(fee.amount_due)
    payment_amount = float(payment.amount)
    total_paid = float(fee.amount_paid)

    remaining_amount = max(
        total_amount - total_paid,
        0,
    )

    return FeeReceiptResponse(
        payment_id=payment.id,
        receipt_number=payment.receipt_number,

        student_id=student.id,
        student_name=student_name,
        admission_number=student.admission_number,
        class_name=class_name,

        fee_id=fee.id,
        fee_title=fee.title,
        total_amount=total_amount,
        previously_paid=previously_paid,
        payment_amount=payment_amount,
        total_paid=total_paid,
        remaining_amount=remaining_amount,

        payment_method=payment.payment_method,
        transaction_reference=payment.transaction_reference,
        payment_date=payment.payment_date,
        remarks=payment.remarks,
    )


@router.get(
    "/me/children/{student_id}/fees/{fee_id}",
    response_model=list[FeePaymentResponse],
)
def get_my_child_fee_payments(
    student_id: int,
    fee_id: int,
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
            detail=(
                "You are not authorized to view "
                "this student's fees"
            ),
        )

    student = (
        db.query(Student)
        .filter(
            Student.id == student_id,
            Student.is_active.is_(True),
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    fee = (
        db.query(Fee)
        .filter(
            Fee.id == fee_id,
            Fee.student_id == student_id,
        )
        .first()
    )

    if not fee:
        raise HTTPException(
            status_code=404,
            detail="Fee not found for this student",
        )

    payments = (
        db.query(FeePayment)
        .filter(FeePayment.fee_id == fee.id)
        .order_by(FeePayment.payment_date.desc())
        .all()
    )

    return payments