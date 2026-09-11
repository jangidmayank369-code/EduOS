from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Fee, FeeStructure, StudentEnrollment
from app.schemas.fee_generation import (
    FeeGenerationRequest,
    FeeGenerationResponse,
)


router = APIRouter(
    prefix="/fees",
    tags=["Fee Generation"],
)


@router.post(
    "/generate",
    response_model=FeeGenerationResponse,
)
def generate_fees(
    data: FeeGenerationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    fee_structure = (
        db.query(FeeStructure)
        .filter(
            FeeStructure.id == data.fee_structure_id,
            FeeStructure.is_active.is_(True),
        )
        .first()
    )

    if not fee_structure:
        raise HTTPException(
            status_code=404,
            detail="Fee structure not found or inactive",
        )

    if fee_structure.academic_session_id != data.academic_session_id:
        raise HTTPException(
            status_code=400,
            detail="Fee structure does not belong to the selected academic session",
        )

    if fee_structure.class_id != data.class_id:
        raise HTTPException(
            status_code=400,
            detail="Fee structure does not belong to the selected class",
        )

    enrollments = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.academic_session_id
            == data.academic_session_id,
            StudentEnrollment.class_id == data.class_id,
            StudentEnrollment.status == "ACTIVE",
        )
        .all()
    )

    generated = 0
    skipped = 0

    for enrollment in enrollments:
        existing_fee = (
            db.query(Fee)
            .filter(
                Fee.student_id == enrollment.student_id,
                Fee.fee_structure_id == data.fee_structure_id,
                Fee.academic_session_id == data.academic_session_id,
            )
            .first()
        )

        if existing_fee:
            skipped += 1
            continue

        fee = Fee(
            student_id=enrollment.student_id,
            fee_structure_id=data.fee_structure_id,
            academic_session_id=data.academic_session_id,
            title=fee_structure.name,
            amount_due=float(fee_structure.amount),
            amount_paid=0,
            status="pending",
        )

        db.add(fee)
        generated += 1

    db.commit()

    return FeeGenerationResponse(
        generated=generated,
        skipped=skipped,
        message=(
            f"Fee generation completed. "
            f"{generated} fee record(s) generated and "
            f"{skipped} existing record(s) skipped."
        ),
    )