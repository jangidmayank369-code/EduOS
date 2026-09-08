from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.admission_application import AdmissionApplication
from app.models.user import User
from app.schemas.admission import (
    AdmissionApplicationCreate,
    AdmissionApplicationResponse,
    AdmissionApplicationUpdate,
    AdmissionStatusUpdate,
)
from app.services.admission_service import convert_admission_to_student


router = APIRouter(
    prefix="/admissions",
    tags=["Admissions"],
)


ALLOWED_STATUSES = {
    "APPLIED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "ADMITTED",
    "CANCELLED",
}


def generate_application_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"ADM-{year}-"

    latest = (
        db.query(AdmissionApplication)
        .filter(
            AdmissionApplication.application_number.like(
                f"{prefix}%"
            )
        )
        .order_by(AdmissionApplication.id.desc())
        .first()
    )

    if latest:
        try:
            last_number = int(
                latest.application_number.split("-")[-1]
            )
        except (ValueError, IndexError):
            last_number = 0
    else:
        last_number = 0

    return f"{prefix}{last_number + 1:05d}"


@router.post(
    "/",
    response_model=AdmissionApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admission_application(
    data: AdmissionApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = AdmissionApplication(
        application_number=generate_application_number(db),
        academic_session_id=data.academic_session_id,
        applying_class_id=data.applying_class_id,
        first_name=data.first_name,
        last_name=data.last_name,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        phone=data.phone,
        email=data.email,
        address=data.address,
        parent_first_name=data.parent_first_name,
        parent_last_name=data.parent_last_name,
        parent_phone=data.parent_phone,
        parent_email=data.parent_email,
        parent_relation=data.parent_relation,
        previous_school_name=data.previous_school_name,
        previous_class=data.previous_class,
        previous_school_result=data.previous_school_result,
        remarks=data.remarks,
        status="APPLIED",
    )

    db.add(application)
    db.commit()
    db.refresh(application)

    return application


@router.get(
    "/",
    response_model=list[AdmissionApplicationResponse],
)
def get_admission_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AdmissionApplication)
        .order_by(
            AdmissionApplication.created_at.desc()
        )
        .all()
    )


@router.get(
    "/{application_id}",
    response_model=AdmissionApplicationResponse,
)
def get_admission_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = (
        db.query(AdmissionApplication)
        .filter(
            AdmissionApplication.id == application_id
        )
        .first()
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Admission application not found",
        )

    return application


@router.put(
    "/{application_id}",
    response_model=AdmissionApplicationResponse,
)
def update_admission_application(
    application_id: int,
    data: AdmissionApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = (
        db.query(AdmissionApplication)
        .filter(
            AdmissionApplication.id == application_id
        )
        .first()
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Admission application not found",
        )

    if application.status in {
        "ADMITTED",
        "CANCELLED",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "This admission application can no longer "
                "be edited because it is already admitted "
                "or cancelled."
            ),
        )

    update_data = data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)

    return application


@router.patch(
    "/{application_id}/status",
    response_model=AdmissionApplicationResponse,
)
def update_admission_status(
    application_id: int,
    data: AdmissionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = (
        db.query(AdmissionApplication)
        .filter(
            AdmissionApplication.id == application_id
        )
        .first()
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Admission application not found",
        )

    new_status = data.status.upper()

    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid admission status. Allowed statuses: "
                + ", ".join(sorted(ALLOWED_STATUSES))
            ),
        )

    if application.status == "ADMITTED":
        raise HTTPException(
            status_code=400,
            detail=(
                "An admitted application cannot "
                "change status."
            ),
        )

    if application.status == "CANCELLED":
        raise HTTPException(
            status_code=400,
            detail=(
                "A cancelled application cannot "
                "change status."
            ),
        )

    application.status = new_status

    if data.remarks is not None:
        application.remarks = data.remarks

    if new_status in {
        "APPROVED",
        "REJECTED",
    }:
        application.reviewed_by_user_id = current_user.id
        application.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(application)

    return application


@router.post(
    "/{application_id}/admit",
)
def admit_student(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student, parent_invitation_token = (
        convert_admission_to_student(
            db=db,
            application_id=application_id,
            current_user=current_user,
        )
    )

    response = {
        "message": "Admission completed successfully",
        "student_id": student.id,
        "admission_number": student.admission_number,
        "parent_invitation_token": parent_invitation_token,
    }

    return response


@router.delete(
    "/{application_id}",
    response_model=AdmissionApplicationResponse,
)
def cancel_admission_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = (
        db.query(AdmissionApplication)
        .filter(
            AdmissionApplication.id == application_id
        )
        .first()
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Admission application not found",
        )

    if application.status == "ADMITTED":
        raise HTTPException(
            status_code=400,
            detail=(
                "An admitted application cannot "
                "be cancelled."
            ),
        )

    application.status = "CANCELLED"
    application.reviewed_by_user_id = current_user.id
    application.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(application)

    return application