from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models import Teacher, User
from app.models.teacher_salary import (
    TeacherPayroll,
    TeacherPayment,
    TeacherPayslip,
    TeacherSalaryStructure,
)
from app.schemas.teacher_salary import (
    TeacherPayrollGenerate,
    TeacherPayrollResponse,
    TeacherPayrollUpdate,
    TeacherPaymentCreate,
    TeacherPaymentResponse,
    TeacherPaymentUpdate,
    TeacherPayslipResponse,
    TeacherSalaryStructureCreate,
    TeacherSalaryStructureResponse,
    TeacherSalaryStructureUpdate,
)


router = APIRouter(
    prefix="/teachers",
    tags=["Teacher Payroll"],
)


PAYROLL_STATUSES = {"DRAFT", "PROCESSED", "PAID", "CANCELLED"}
PAYMENT_STATUSES = {"PENDING", "COMPLETED", "FAILED", "REVERSED"}


def _get_teacher_or_404(db: Session, teacher_id: int) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )
    return teacher


def _get_structure_or_404(
    db: Session,
    teacher_id: int,
    structure_id: int,
) -> TeacherSalaryStructure:
    structure = (
        db.query(TeacherSalaryStructure)
        .filter(
            TeacherSalaryStructure.id == structure_id,
            TeacherSalaryStructure.teacher_id == teacher_id,
        )
        .first()
    )
    if not structure:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Salary structure not found",
        )
    return structure


def _get_payroll_or_404(
    db: Session,
    teacher_id: int,
    payroll_id: int,
) -> TeacherPayroll:
    payroll = (
        db.query(TeacherPayroll)
        .filter(
            TeacherPayroll.id == payroll_id,
            TeacherPayroll.teacher_id == teacher_id,
        )
        .first()
    )
    if not payroll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll record not found",
        )
    return payroll


def _get_payment_or_404(
    db: Session,
    teacher_id: int,
    payroll_id: int,
    payment_id: int,
) -> TeacherPayment:
    payment = (
        db.query(TeacherPayment)
        .join(TeacherPayroll, TeacherPayroll.id == TeacherPayment.payroll_id)
        .filter(
            TeacherPayment.id == payment_id,
            TeacherPayment.payroll_id == payroll_id,
            TeacherPayroll.teacher_id == teacher_id,
        )
        .first()
    )
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment record not found",
        )
    return payment


def _money(value) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Salary JSON contains an invalid numeric amount",
        ) from exc


def _sum_money(values: dict) -> Decimal:
    total = Decimal("0.00")
    for value in values.values():
        amount = _money(value)
        if amount < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Salary components cannot contain negative amounts",
            )
        total += amount
    return total.quantize(Decimal("0.01"))


def _validate_structure_overlap(
    db: Session,
    teacher_id: int,
    effective_from: date,
    effective_to: date | None,
    ignore_id: int | None = None,
):
    structures = (
        db.query(TeacherSalaryStructure)
        .filter(TeacherSalaryStructure.teacher_id == teacher_id)
        .all()
    )

    for existing in structures:
        if ignore_id is not None and existing.id == ignore_id:
            continue

        existing_to = existing.effective_to or date.max
        new_to = effective_to or date.max

        if effective_from <= existing_to and existing.effective_from <= new_to:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Salary structure effective dates overlap an existing structure",
            )


def _effective_structure(
    db: Session,
    teacher_id: int,
    payroll_year: int,
    payroll_month: int,
) -> TeacherSalaryStructure | None:
    month_start = date(payroll_year, payroll_month, 1)
    month_end = date(
        payroll_year,
        payroll_month,
        monthrange(payroll_year, payroll_month)[1],
    )

    return (
        db.query(TeacherSalaryStructure)
        .filter(
            TeacherSalaryStructure.teacher_id == teacher_id,
            TeacherSalaryStructure.is_active.is_(True),
            TeacherSalaryStructure.effective_from <= month_end,
            (TeacherSalaryStructure.effective_to.is_(None))
            | (TeacherSalaryStructure.effective_to >= month_start),
        )
        .order_by(TeacherSalaryStructure.effective_from.desc())
        .first()
    )


def _paid_amount(db: Session, payroll_id: int) -> Decimal:
    payments = (
        db.query(TeacherPayment)
        .filter(
            TeacherPayment.payroll_id == payroll_id,
            TeacherPayment.status == "COMPLETED",
        )
        .all()
    )
    return sum((payment.amount for payment in payments), Decimal("0.00"))


def _validate_payroll_status(value: str):
    normalized = value.strip().upper()
    if normalized not in PAYROLL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid payroll status. Allowed: {', '.join(sorted(PAYROLL_STATUSES))}",
        )
    return normalized


def _validate_payment_status(value: str):
    normalized = value.strip().upper()
    if normalized not in PAYMENT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid payment status. Allowed: {', '.join(sorted(PAYMENT_STATUSES))}",
        )
    return normalized


@router.get(
    "/{teacher_id}/salary-structures",
    response_model=list[TeacherSalaryStructureResponse],
)
def list_salary_structures(
    teacher_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)
    return (
        db.query(TeacherSalaryStructure)
        .filter(TeacherSalaryStructure.teacher_id == teacher_id)
        .order_by(TeacherSalaryStructure.effective_from.desc())
        .all()
    )


@router.post(
    "/{teacher_id}/salary-structures",
    response_model=TeacherSalaryStructureResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_salary_structure(
    teacher_id: int,
    data: TeacherSalaryStructureCreate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)
    _validate_structure_overlap(
        db,
        teacher_id,
        data.effective_from,
        data.effective_to,
    )

    structure = TeacherSalaryStructure(
        teacher_id=teacher_id,
        effective_from=data.effective_from,
        effective_to=data.effective_to,
        basic_salary=data.basic_salary,
        allowances={key: str(value) for key, value in data.allowances.items()},
        deductions={key: str(value) for key, value in data.deductions.items()},
        payroll_type=data.payroll_type.strip().upper(),
        is_active=data.is_active,
        notes=data.notes,
    )
    db.add(structure)
    db.commit()
    db.refresh(structure)
    return structure


@router.get(
    "/{teacher_id}/salary-structures/{structure_id}",
    response_model=TeacherSalaryStructureResponse,
)
def get_salary_structure(
    teacher_id: int,
    structure_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    return _get_structure_or_404(db, teacher_id, structure_id)


@router.put(
    "/{teacher_id}/salary-structures/{structure_id}",
    response_model=TeacherSalaryStructureResponse,
)
def update_salary_structure(
    teacher_id: int,
    structure_id: int,
    data: TeacherSalaryStructureUpdate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    structure = _get_structure_or_404(db, teacher_id, structure_id)
    update_data = data.model_dump(exclude_unset=True)

    effective_from = update_data.get("effective_from", structure.effective_from)
    effective_to = update_data.get("effective_to", structure.effective_to)
    _validate_structure_overlap(
        db,
        teacher_id,
        effective_from,
        effective_to,
        ignore_id=structure.id,
    )

    for key in (
        "effective_from",
        "effective_to",
        "basic_salary",
        "is_active",
        "notes",
    ):
        if key in update_data:
            setattr(structure, key, update_data[key])

    if "allowances" in update_data and update_data["allowances"] is not None:
        structure.allowances = {
            key: str(value) for key, value in update_data["allowances"].items()
        }

    if "deductions" in update_data and update_data["deductions"] is not None:
        structure.deductions = {
            key: str(value) for key, value in update_data["deductions"].items()
        }

    if "payroll_type" in update_data and update_data["payroll_type"] is not None:
        structure.payroll_type = update_data["payroll_type"].strip().upper()

    db.commit()
    db.refresh(structure)
    return structure


@router.delete(
    "/{teacher_id}/salary-structures/{structure_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_salary_structure(
    teacher_id: int,
    structure_id: int,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    structure = _get_structure_or_404(db, teacher_id, structure_id)
    structure.is_active = False
    db.commit()
    return None


@router.post(
    "/{teacher_id}/payrolls/generate",
    response_model=TeacherPayrollResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_payroll(
    teacher_id: int,
    data: TeacherPayrollGenerate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)

    existing = (
        db.query(TeacherPayroll)
        .filter(
            TeacherPayroll.teacher_id == teacher_id,
            TeacherPayroll.payroll_year == data.payroll_year,
            TeacherPayroll.payroll_month == data.payroll_month,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payroll already exists for this teacher and month",
        )

    structure = _effective_structure(
        db,
        teacher_id,
        data.payroll_year,
        data.payroll_month,
    )
    if not structure:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active salary structure is effective for this payroll month",
        )

    allowances = dict(structure.allowances or {})
    deductions = dict(structure.deductions or {})
    gross_salary = (structure.basic_salary + _sum_money(allowances)).quantize(
        Decimal("0.01")
    )
    total_deductions = _sum_money(deductions)
    net_salary = (gross_salary - total_deductions).quantize(Decimal("0.01"))

    if net_salary < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total deductions cannot exceed gross salary",
        )

    payroll = TeacherPayroll(
        teacher_id=teacher_id,
        salary_structure_id=structure.id,
        payroll_year=data.payroll_year,
        payroll_month=data.payroll_month,
        basic_salary=structure.basic_salary,
        allowances_snapshot=allowances,
        deductions_snapshot=deductions,
        gross_salary=gross_salary,
        total_deductions=total_deductions,
        net_salary=net_salary,
        status="DRAFT",
        notes=data.notes,
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)
    return payroll


@router.get(
    "/{teacher_id}/payrolls",
    response_model=list[TeacherPayrollResponse],
)
def list_payrolls(
    teacher_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)
    return (
        db.query(TeacherPayroll)
        .filter(TeacherPayroll.teacher_id == teacher_id)
        .order_by(
            TeacherPayroll.payroll_year.desc(),
            TeacherPayroll.payroll_month.desc(),
        )
        .all()
    )


@router.get(
    "/{teacher_id}/payrolls/{payroll_id}",
    response_model=TeacherPayrollResponse,
)
def get_payroll(
    teacher_id: int,
    payroll_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    return _get_payroll_or_404(db, teacher_id, payroll_id)


@router.put(
    "/{teacher_id}/payrolls/{payroll_id}",
    response_model=TeacherPayrollResponse,
)
def update_payroll(
    teacher_id: int,
    payroll_id: int,
    data: TeacherPayrollUpdate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    payroll = _get_payroll_or_404(db, teacher_id, payroll_id)
    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] is not None:
        new_status = _validate_payroll_status(update_data["status"])
        if payroll.status == "PAID" and new_status != "PAID":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid payroll cannot be moved back to another status",
            )
        if new_status == "PAID" and _paid_amount(db, payroll.id) < payroll.net_salary:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payroll cannot be marked PAID before the full net salary is paid",
            )
        payroll.status = new_status
        if new_status == "PROCESSED" and payroll.processed_at is None:
            payroll.processed_at = datetime.utcnow()
            payroll.processed_by_user_id = current_user.id

    if "notes" in update_data:
        payroll.notes = update_data["notes"]

    db.commit()
    db.refresh(payroll)
    return payroll


@router.post(
    "/{teacher_id}/payrolls/{payroll_id}/payslip",
    response_model=TeacherPayslipResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payslip(
    teacher_id: int,
    payroll_id: int,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    payroll = _get_payroll_or_404(db, teacher_id, payroll_id)

    if payroll.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot issue a payslip for cancelled payroll",
        )

    if payroll.payslip:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payslip already exists for this payroll",
        )

    period = f"{payroll.payroll_year}{payroll.payroll_month:02d}"
    payslip_number = f"PS-{period}-{teacher_id}-{uuid4().hex[:8].upper()}"

    payslip = TeacherPayslip(
        payroll_id=payroll.id,
        payslip_number=payslip_number,
        issue_date=date.today(),
        earnings_snapshot={
            "basic_salary": str(payroll.basic_salary),
            **(payroll.allowances_snapshot or {}),
        },
        deductions_snapshot=dict(payroll.deductions_snapshot or {}),
        net_salary=payroll.net_salary,
        status="ISSUED",
    )
    db.add(payslip)
    db.commit()
    db.refresh(payslip)
    return payslip


@router.get(
    "/{teacher_id}/payrolls/{payroll_id}/payslip",
    response_model=TeacherPayslipResponse,
)
def get_payslip(
    teacher_id: int,
    payroll_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    payroll = _get_payroll_or_404(db, teacher_id, payroll_id)
    if not payroll.payslip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payslip not found",
        )
    return payroll.payslip


@router.get(
    "/{teacher_id}/payments",
    response_model=list[TeacherPaymentResponse],
)
def list_teacher_payments(
    teacher_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)
    return (
        db.query(TeacherPayment)
        .join(TeacherPayroll, TeacherPayroll.id == TeacherPayment.payroll_id)
        .filter(TeacherPayroll.teacher_id == teacher_id)
        .order_by(TeacherPayment.payment_date.desc(), TeacherPayment.id.desc())
        .all()
    )


@router.post(
    "/{teacher_id}/payrolls/{payroll_id}/payments",
    response_model=TeacherPaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment(
    teacher_id: int,
    payroll_id: int,
    data: TeacherPaymentCreate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    payroll = _get_payroll_or_404(db, teacher_id, payroll_id)

    if payroll.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot record a payment against cancelled payroll",
        )

    payment_status = _validate_payment_status(data.status)
    already_paid = _paid_amount(db, payroll.id)
    if payment_status == "COMPLETED" and already_paid + data.amount > payroll.net_salary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed payments cannot exceed the payroll net salary",
        )

    payment = TeacherPayment(
        payroll_id=payroll.id,
        payment_date=data.payment_date,
        amount=data.amount,
        payment_method=data.payment_method.strip().upper(),
        transaction_reference=data.transaction_reference,
        status=payment_status,
        remarks=data.remarks,
        created_by_user_id=current_user.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get(
    "/{teacher_id}/payrolls/{payroll_id}/payments",
    response_model=list[TeacherPaymentResponse],
)
def list_payroll_payments(
    teacher_id: int,
    payroll_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    _get_payroll_or_404(db, teacher_id, payroll_id)
    return (
        db.query(TeacherPayment)
        .filter(TeacherPayment.payroll_id == payroll_id)
        .order_by(TeacherPayment.payment_date.desc(), TeacherPayment.id.desc())
        .all()
    )


@router.put(
    "/{teacher_id}/payrolls/{payroll_id}/payments/{payment_id}",
    response_model=TeacherPaymentResponse,
)
def update_payment(
    teacher_id: int,
    payroll_id: int,
    payment_id: int,
    data: TeacherPaymentUpdate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    payroll = _get_payroll_or_404(db, teacher_id, payroll_id)
    payment = _get_payment_or_404(db, teacher_id, payroll_id, payment_id)
    update_data = data.model_dump(exclude_unset=True)

    new_status = payment.status
    if "status" in update_data and update_data["status"] is not None:
        new_status = _validate_payment_status(update_data["status"])

    new_amount = update_data.get("amount", payment.amount)
    completed_other = _paid_amount(db, payroll.id)
    if payment.status == "COMPLETED":
        completed_other -= payment.amount

    if new_status == "COMPLETED" and completed_other + new_amount > payroll.net_salary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed payments cannot exceed the payroll net salary",
        )

    if "payment_date" in update_data:
        payment.payment_date = update_data["payment_date"]
    if "amount" in update_data:
        payment.amount = update_data["amount"]
    if "payment_method" in update_data and update_data["payment_method"] is not None:
        payment.payment_method = update_data["payment_method"].strip().upper()
    if "transaction_reference" in update_data:
        payment.transaction_reference = update_data["transaction_reference"]
    if "status" in update_data and update_data["status"] is not None:
        payment.status = new_status
    if "remarks" in update_data:
        payment.remarks = update_data["remarks"]

    db.commit()
    db.refresh(payment)
    return payment


@router.delete(
    "/{teacher_id}/payrolls/{payroll_id}/payments/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_payment(
    teacher_id: int,
    payroll_id: int,
    payment_id: int,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    payment = _get_payment_or_404(db, teacher_id, payroll_id, payment_id)
    payment.status = "REVERSED"
    db.commit()
    return None


@router.get(
    "/me/payrolls",
    response_model=list[TeacherPayrollResponse],
)
def get_my_payrolls(
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile is not linked to this account",
        )
    return (
        db.query(TeacherPayroll)
        .filter(TeacherPayroll.teacher_id == teacher.id)
        .order_by(
            TeacherPayroll.payroll_year.desc(),
            TeacherPayroll.payroll_month.desc(),
        )
        .all()
    )


@router.get(
    "/me/payments",
    response_model=list[TeacherPaymentResponse],
)
def get_my_payments(
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile is not linked to this account",
        )
    return (
        db.query(TeacherPayment)
        .join(TeacherPayroll, TeacherPayroll.id == TeacherPayment.payroll_id)
        .filter(TeacherPayroll.teacher_id == teacher.id)
        .order_by(TeacherPayment.payment_date.desc(), TeacherPayment.id.desc())
        .all()
    )
