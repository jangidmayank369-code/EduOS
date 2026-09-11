from datetime import date
from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Exam, ExamSubject, User
from app.schemas.exam import (
    ExamCopyResponse,
    ExamCreate,
    ExamResponse,
    ExamUpdate,
)


router = APIRouter(
    prefix="/exams",
    tags=["Exams"],
)


# ============================================================
# Constants
# ============================================================


VALID_EXAM_TYPES = {
    "UNIT_TEST",
    "PERIODIC_TEST",
    "HALF_YEARLY",
    "ANNUAL",
    "PRE_BOARD",
    "CLASS_TEST",
    "MONTHLY_TEST",
    "PRACTICAL",
    "EXAM",
    "OTHER",
}


VALID_STATUSES = {
    "DRAFT",
    "ACTIVE",
    "LOCKED",
    "PUBLISHED",
}


ALLOWED_STATUS_TRANSITIONS = {
    "DRAFT": {"ACTIVE"},
    "ACTIVE": {"DRAFT", "LOCKED"},
    "LOCKED": {"ACTIVE", "PUBLISHED"},
    "PUBLISHED": set(),
}


# ============================================================
# Validation Helpers
# ============================================================


def validate_exam_dates(
    start_date: date | None,
    end_date: date | None,
) -> None:
    if (
        start_date is not None
        and end_date is not None
        and end_date < start_date
    ):
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date",
        )


def validate_exam_type(
    exam_type: str,
) -> str:
    normalized = exam_type.strip().upper()

    if normalized not in VALID_EXAM_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid exam_type. Allowed values: "
                f"{', '.join(sorted(VALID_EXAM_TYPES))}"
            ),
        )

    return normalized


def validate_status(
    status: str,
) -> str:
    normalized = status.strip().upper()

    if normalized not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid status. Allowed values: "
                f"{', '.join(sorted(VALID_STATUSES))}"
            ),
        )

    return normalized


def validate_weightage(
    weightage: float,
) -> float:
    if weightage < 0 or weightage > 100:
        raise HTTPException(
            status_code=400,
            detail="Weightage must be between 0 and 100",
        )

    return weightage


def get_active_exam_or_404(
    db: Session,
    exam_id: int,
) -> Exam:
    exam = (
        db.query(Exam)
        .filter(
            Exam.id == exam_id,
            Exam.is_active.is_(True),
        )
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found",
        )

    return exam


def ensure_exam_editable(
    exam: Exam,
) -> None:
    if exam.status in {"LOCKED", "PUBLISHED"}:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Exam is {exam.status.lower()} "
                "and cannot be edited"
            ),
        )


# ============================================================
# CREATE EXAM
# ============================================================


@router.post(
    "/",
    response_model=ExamResponse,
    status_code=201,
)
def create_exam(
    data: ExamCreate,
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    exam_type = validate_exam_type(
        data.exam_type
    )

    status = validate_status(
        data.status
    )

    validate_exam_dates(
        data.start_date,
        data.end_date,
    )

    weightage = validate_weightage(
        data.weightage
    )

    exam = Exam(
        name=data.name.strip(),
        description=data.description,
        exam_type=exam_type,
        academic_year=data.academic_year,
        term=data.term,
        start_date=data.start_date,
        end_date=data.end_date,
        include_in_result=data.include_in_result,
        weightage=weightage,
        status=status,
        is_active=data.is_active,
    )

    db.add(exam)
    db.commit()
    db.refresh(exam)

    return exam


# ============================================================
# LIST EXAMS
# ============================================================


@router.get(
    "/",
    response_model=list[ExamResponse],
)
def get_exams(
    include_inactive: bool = Query(
        default=False,
    ),
    status: str | None = Query(
        default=None,
    ),
    exam_type: str | None = Query(
        default=None,
    ),
    academic_year: str | None = Query(
        default=None,
    ),
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    query = db.query(Exam)

    if not include_inactive:
        query = query.filter(
            Exam.is_active.is_(True)
        )

    if status is not None:
        normalized_status = validate_status(status)

        query = query.filter(
            Exam.status == normalized_status
        )

    if exam_type is not None:
        normalized_exam_type = validate_exam_type(
            exam_type
        )

        query = query.filter(
            Exam.exam_type == normalized_exam_type
        )

    if academic_year is not None:
        query = query.filter(
            Exam.academic_year == academic_year
        )

    exams = (
        query
        .order_by(
            Exam.start_date.desc().nullslast(),
            Exam.id.desc(),
        )
        .all()
    )

    return exams


# ============================================================
# GET SINGLE EXAM
# ============================================================


@router.get(
    "/{exam_id}",
    response_model=ExamResponse,
)
def get_exam(
    exam_id: int,
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    return get_active_exam_or_404(
        db,
        exam_id,
    )


# ============================================================
# UPDATE EXAM
# ============================================================


@router.put(
    "/{exam_id}",
    response_model=ExamResponse,
)
def update_exam(
    exam_id: int,
    data: ExamUpdate,
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    exam = get_active_exam_or_404(
        db,
        exam_id,
    )

    ensure_exam_editable(exam)

    if data.name is not None:
        cleaned_name = data.name.strip()

        if not cleaned_name:
            raise HTTPException(
                status_code=400,
                detail="Exam name cannot be empty",
            )

        exam.name = cleaned_name

    if data.description is not None:
        exam.description = data.description

    if data.exam_type is not None:
        exam.exam_type = validate_exam_type(
            data.exam_type
        )

    if data.academic_year is not None:
        exam.academic_year = data.academic_year

    if data.term is not None:
        exam.term = data.term

    if data.start_date is not None:
        exam.start_date = data.start_date

    if data.end_date is not None:
        exam.end_date = data.end_date

    validate_exam_dates(
        exam.start_date,
        exam.end_date,
    )

    if data.include_in_result is not None:
        exam.include_in_result = (
            data.include_in_result
        )

    if data.weightage is not None:
        exam.weightage = validate_weightage(
            data.weightage
        )

    if data.status is not None:
        new_status = validate_status(
            data.status
        )

        if new_status != exam.status:
            allowed = ALLOWED_STATUS_TRANSITIONS.get(
                exam.status,
                set(),
            )

            if new_status not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Cannot change exam status "
                        f"from {exam.status} "
                        f"to {new_status}"
                    ),
                )

            exam.status = new_status

    if data.is_active is not None:
        exam.is_active = data.is_active

    db.commit()
    db.refresh(exam)

    return exam


# ============================================================
# CHANGE EXAM STATUS
# ============================================================


@router.patch(
    "/{exam_id}/status",
    response_model=ExamResponse,
)
def change_exam_status(
    exam_id: int,
    status: str,
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    exam = get_active_exam_or_404(
        db,
        exam_id,
    )

    new_status = validate_status(status)

    if new_status == exam.status:
        return exam

    allowed = ALLOWED_STATUS_TRANSITIONS.get(
        exam.status,
        set(),
    )

    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot change exam status "
                f"from {exam.status} "
                f"to {new_status}"
            ),
        )

    exam.status = new_status

    db.commit()
    db.refresh(exam)

    return exam


# ============================================================
# INCLUDE / EXCLUDE FROM FINAL RESULT
# ============================================================


@router.patch(
    "/{exam_id}/result-inclusion",
    response_model=ExamResponse,
)
def set_result_inclusion(
    exam_id: int,
    include_in_result: bool,
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    exam = get_active_exam_or_404(
        db,
        exam_id,
    )

    if exam.status in {"LOCKED", "PUBLISHED"}:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{exam.status.title()} exam "
                "cannot change final-result inclusion"
            ),
        )

    exam.include_in_result = include_in_result

    db.commit()
    db.refresh(exam)

    return exam


# ============================================================
# COPY PREVIOUS EXAM
# ============================================================


@router.post(
    "/{exam_id}/copy",
    response_model=ExamCopyResponse,
    status_code=201,
)
def copy_exam(
    exam_id: int,
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    source_exam = get_active_exam_or_404(
        db,
        exam_id,
    )

    # --------------------------------------------------------
    # Create the new exam
    # --------------------------------------------------------

    copied_exam = Exam(
        name=f"{source_exam.name} - Copy",
        description=source_exam.description,
        exam_type=source_exam.exam_type,
        academic_year=source_exam.academic_year,
        term=source_exam.term,
        start_date=source_exam.start_date,
        end_date=source_exam.end_date,
        include_in_result=False,
        weightage=source_exam.weightage,
        status="DRAFT",
        is_active=True,
    )

    db.add(copied_exam)
    db.flush()

    # --------------------------------------------------------
    # Copy subject configuration
    # --------------------------------------------------------

    source_subjects = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == source_exam.id
        )
        .all()
    )

    copied_count = 0

    for source_subject in source_subjects:
        source_components = (
            source_subject.components
            if source_subject.components
            else []
        )

        copied_subject = ExamSubject(
            exam_id=copied_exam.id,
            class_id=source_subject.class_id,
            subject_id=source_subject.subject_id,
            max_marks=source_subject.max_marks,
            pass_marks=source_subject.pass_marks,
            components=deepcopy(
                source_components
            ),
            is_optional=source_subject.is_optional,
            include_in_result=(
                source_subject.include_in_result
            ),
        )

        db.add(copied_subject)
        copied_count += 1

    db.commit()
    db.refresh(copied_exam)

    return ExamCopyResponse(
        message="Exam copied successfully",
        exam_id=copied_exam.id,
        exam_name=copied_exam.name,
        subjects_copied=copied_count,
    )


# ============================================================
# SOFT DELETE
# ============================================================


@router.delete(
    "/{exam_id}",
)
def delete_exam(
    exam_id: int,
    current_user: User = Depends(
        require_role("admin")
    ),
    db: Session = Depends(get_db),
):
    exam = get_active_exam_or_404(
        db,
        exam_id,
    )

    if exam.status in {"LOCKED", "PUBLISHED"}:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{exam.status.title()} exam "
                "cannot be deleted"
            ),
        )

    exam.is_active = False

    db.commit()

    return {
        "message": "Exam deleted successfully",
        "exam_id": exam.id,
    }