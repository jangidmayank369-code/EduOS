from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Teacher, TeacherEmploymentProfile, User
from app.schemas.teacher_employment_profile import (
    TeacherEmploymentProfileCreate,
    TeacherEmploymentProfileResponse,
    TeacherEmploymentProfileUpdate,
)


router = APIRouter(
    prefix="/teachers",
    tags=["Teacher Employment"],
)


def _get_teacher_or_404(
    db: Session,
    teacher_id: int,
) -> Teacher:
    teacher = (
        db.query(Teacher)
        .filter(Teacher.id == teacher_id)
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    return teacher


def _validate_profile_dates(
    *,
    joining_date,
    confirmation_date,
    resignation_date,
    last_working_date,
) -> None:
    if confirmation_date and joining_date and confirmation_date < joining_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation date cannot be before joining date.",
        )

    if resignation_date and joining_date and resignation_date < joining_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resignation date cannot be before joining date.",
        )

    if last_working_date and joining_date and last_working_date < joining_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last working date cannot be before joining date.",
        )

    if last_working_date and resignation_date and last_working_date < resignation_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last working date cannot be before resignation date.",
        )


@router.post(
    "/{teacher_id}/employment-profile",
    response_model=TeacherEmploymentProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_employment_profile(
    teacher_id: int,
    data: TeacherEmploymentProfileCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)

    existing = (
        db.query(TeacherEmploymentProfile)
        .filter(TeacherEmploymentProfile.teacher_id == teacher_id)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Teacher employment profile already exists",
        )

    _validate_profile_dates(
        joining_date=data.joining_date,
        confirmation_date=data.confirmation_date,
        resignation_date=data.resignation_date,
        last_working_date=data.last_working_date,
    )

    profile = TeacherEmploymentProfile(
        teacher_id=teacher_id,
        designation=data.designation,
        department=data.department,
        employment_type=data.employment_type.strip(),
        employment_status=data.employment_status.strip(),
        joining_date=data.joining_date,
        confirmation_date=data.confirmation_date,
        resignation_date=data.resignation_date,
        last_working_date=data.last_working_date,
        qualification=data.qualification,
        specialization=data.specialization,
        experience_years=data.experience_years,
        notes=data.notes,
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


@router.get(
    "/{teacher_id}/employment-profile",
    response_model=TeacherEmploymentProfileResponse,
)
def get_teacher_employment_profile(
    teacher_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)

    profile = (
        db.query(TeacherEmploymentProfile)
        .filter(TeacherEmploymentProfile.teacher_id == teacher_id)
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher employment profile not found",
        )

    return profile


@router.put(
    "/{teacher_id}/employment-profile",
    response_model=TeacherEmploymentProfileResponse,
)
def update_teacher_employment_profile(
    teacher_id: int,
    data: TeacherEmploymentProfileUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)

    profile = (
        db.query(TeacherEmploymentProfile)
        .filter(TeacherEmploymentProfile.teacher_id == teacher_id)
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher employment profile not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    for field_name, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(profile, field_name, value)

    _validate_profile_dates(
        joining_date=profile.joining_date,
        confirmation_date=profile.confirmation_date,
        resignation_date=profile.resignation_date,
        last_working_date=profile.last_working_date,
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


@router.delete(
    "/{teacher_id}/employment-profile",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_teacher_employment_profile(
    teacher_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)

    profile = (
        db.query(TeacherEmploymentProfile)
        .filter(TeacherEmploymentProfile.teacher_id == teacher_id)
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher employment profile not found",
        )

    db.delete(profile)
    db.commit()

    return None
