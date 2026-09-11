from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import require_role

from app.models.exam import Exam
from app.models.exam_subject import ExamSubject
from app.models.mark import Mark
from app.models.student import Student
from app.models.subject import Subject

from app.models.result_configuration import (
    ResultConfiguration,
    ResultConfigurationExam,
)

from app.schemas.final_result import (
    FinalResultPreview,
    ResultConfigurationCreate,
    ResultConfigurationExamCreate,
    ResultConfigurationResponse,
    ResultConfigurationUpdate,
)


router = APIRouter(
    prefix="/final-results",
    tags=["Final Results"],
)


CALCULATION_METHODS = {
    "WEIGHTED",
    "AVERAGE",
    "BEST_OF",
}

CONFIG_STATUSES = {
    "DRAFT",
    "REVIEW",
    "LOCKED",
    "PUBLISHED",
}


# ============================================================
# BASIC HELPERS
# ============================================================

def round_value(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def calculate_grade(percentage: float) -> str:
    if percentage >= 90:
        return "A+"
    if percentage >= 80:
        return "A"
    if percentage >= 70:
        return "B+"
    if percentage >= 60:
        return "B"
    if percentage >= 50:
        return "C"
    if percentage >= 40:
        return "D"
    return "F"


def normalize_method(method: str) -> str:
    value = (method or "").strip().upper()

    if value not in CALCULATION_METHODS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid calculation_method '{method}'. "
                f"Allowed: {', '.join(sorted(CALCULATION_METHODS))}"
            ),
        )

    return value


def student_name(student: Student) -> str:
    return (
        f"{student.first_name} {student.last_name}"
    ).strip()


# ============================================================
# CONFIGURATION VALIDATION
# ============================================================

def validate_configuration_exams(
    db: Session,
    configuration: ResultConfiguration,
) -> list[ResultConfigurationExam]:
    exam_links = [
        link
        for link in configuration.exams
        if link.include_in_result
    ]

    if not exam_links:
        raise HTTPException(
            status_code=400,
            detail="At least one exam must be included in the result.",
        )

    exam_ids = [link.exam_id for link in exam_links]

    if len(exam_ids) != len(set(exam_ids)):
        raise HTTPException(
            status_code=400,
            detail="The same exam cannot be selected more than once.",
        )

    exams = (
        db.query(Exam)
        .filter(Exam.id.in_(exam_ids))
        .all()
    )

    exam_map = {
        exam.id: exam
        for exam in exams
    }

    missing_exams = [
        exam_id
        for exam_id in exam_ids
        if exam_id not in exam_map
    ]

    if missing_exams:
        raise HTTPException(
            status_code=404,
            detail=f"Exam(s) not found: {missing_exams}",
        )

    for exam_id in exam_ids:
        exam = exam_map[exam_id]

        if not exam.is_active:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Exam '{exam.name}' is inactive "
                    "and cannot be included."
                ),
            )

    method = normalize_method(
        configuration.calculation_method
    )

    if method == "WEIGHTED":
        total_weight = sum(
            float(link.weightage)
            for link in exam_links
        )

        if total_weight <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Weighted result requires exam weightage "
                    "greater than zero."
                ),
            )

        if abs(total_weight - 100) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Weighted exam weightage must total 100. "
                    f"Current total: {round_value(total_weight)}"
                ),
            )

    if method == "BEST_OF":
        if not configuration.best_of_count:
            raise HTTPException(
                status_code=400,
                detail=(
                    "best_of_count is required for BEST_OF "
                    "calculation."
                ),
            )

        if configuration.best_of_count > len(exam_links):
            raise HTTPException(
                status_code=400,
                detail=(
                    "best_of_count cannot be greater than "
                    "the number of selected exams."
                ),
            )

    return exam_links


# ============================================================
# RESULT CALCULATION ENGINE
# ============================================================

def calculate_component(
    values: list[float],
    weights: list[float],
    method: str,
    best_of_count: int | None = None,
) -> float:
    """
    Calculates a percentage from exam percentages.

    values:
        Exam-wise percentages.

    weights:
        Exam-wise weightages.

    Returns:
        Final percentage from 0 to 100.
    """

    if not values:
        return 0.0

    method = normalize_method(method)

    if method == "AVERAGE":
        return sum(values) / len(values)

    if method == "BEST_OF":
        count = best_of_count or 1

        selected = sorted(
            values,
            reverse=True,
        )[:count]

        if not selected:
            return 0.0

        return sum(selected) / len(selected)

    # WEIGHTED
    total_weight = sum(weights)

    if total_weight <= 0:
        return 0.0

    return sum(
        value * weight
        for value, weight in zip(values, weights)
    ) / total_weight


# ============================================================
# LOAD MARK DATA
# ============================================================

def load_marks_for_student(
    db: Session,
    student_id: int,
    exam_ids: list[int],
) -> list[Mark]:
    if not exam_ids:
        return []

    return (
        db.query(Mark)
        .filter(
            Mark.student_id == student_id,
            Mark.exam_id.in_(exam_ids),
        )
        .all()
    )


def build_mark_map(
    marks: list[Mark],
) -> dict[tuple[int, int], Mark]:
    return {
        (mark.exam_id, mark.subject_id): mark
        for mark in marks
    }


# ============================================================
# SUBJECT CONFIGURATION
# ============================================================

def load_exam_subjects(
    db: Session,
    exam_ids: list[int],
    class_id: int,
) -> list[ExamSubject]:
    if not exam_ids:
        return []

    return (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id.in_(exam_ids),
            ExamSubject.class_id == class_id,
            ExamSubject.include_in_result.is_(True),
        )
        .all()
    )


def build_subject_map(
    exam_subjects: list[ExamSubject],
) -> dict[int, list[ExamSubject]]:
    result: dict[int, list[ExamSubject]] = defaultdict(list)

    for exam_subject in exam_subjects:
        result[exam_subject.subject_id].append(
            exam_subject
        )

    return result


# ============================================================
# SUBJECT PREVIEW
# ============================================================

def calculate_subject_preview(
    db: Session,
    student: Student,
    configuration: ResultConfiguration,
    exam_links: list[ResultConfigurationExam],
    marks: list[Mark],
    exam_subjects: list[ExamSubject],
) -> tuple[list[dict[str, Any]], list[int]]:
    mark_map = build_mark_map(marks)

    subject_map = build_subject_map(
        exam_subjects
    )

    subject_ids = sorted(subject_map.keys())

    subjects = (
        db.query(Subject)
        .filter(
            Subject.id.in_(subject_ids)
        )
        .all()
    )

    subject_lookup = {
        subject.id: subject
        for subject in subjects
    }

    method = normalize_method(
        configuration.calculation_method
    )

    preview_rows: list[dict[str, Any]] = []

    all_missing_exam_ids: set[int] = set()

    for subject_id in subject_ids:
        subject_exam_configs = subject_map[
            subject_id
        ]

        percentages: list[float] = []
        weights: list[float] = []

        missing_exams: list[int] = []

        # Keep the highest/appropriate configured
        # max/pass values available for this subject.
        compulsory_configs = [
            config
            for config in subject_exam_configs
            if not config.is_optional
        ]

        for exam_link in exam_links:
            exam_subject = next(
                (
                    item
                    for item in subject_exam_configs
                    if item.exam_id == exam_link.exam_id
                ),
                None,
            )

            if exam_subject is None:
                continue

            mark = mark_map.get(
                (
                    exam_link.exam_id,
                    subject_id,
                )
            )

            if mark is None:
                missing_exams.append(
                    exam_link.exam_id
                )
                all_missing_exam_ids.add(
                    exam_link.exam_id
                )
                continue

            max_marks = float(
                mark.max_marks
            )

            if max_marks <= 0:
                continue

            percentage = (
                float(mark.marks_obtained)
                / max_marks
            ) * 100

            percentages.append(
                round_value(percentage)
            )

            weights.append(
                float(exam_link.weightage)
            )

        if not percentages:
            final_percentage = 0.0
        else:
            final_percentage = calculate_component(
                values=percentages,
                weights=weights,
                method=method,
                best_of_count=configuration.best_of_count,
            )

        # Calculate display marks using percentage
        # against a normalized 100-point final scale.
        final_max_marks = 100.0
        final_total_marks = final_percentage

        grade = calculate_grade(
            final_percentage
        )

        # For compulsory subjects, missing marks mean
        # the final subject cannot safely be marked passed.
        subject_is_compulsory = bool(
            compulsory_configs
        )

        is_pass = (
            final_percentage >= 40
            and not (
                subject_is_compulsory
                and missing_exams
            )
        )

        subject_obj = subject_lookup.get(
            subject_id
        )

        preview_rows.append(
            {
                "subject_id": subject_id,
                "subject_name": (
                    subject_obj.name
                    if subject_obj
                    else f"Subject {subject_id}"
                ),
                "total_marks": round_value(
                    final_total_marks
                ),
                "max_marks": final_max_marks,
                "percentage": round_value(
                    final_percentage
                ),
                "grade": grade,
                "is_pass": is_pass,
                "missing_exams": missing_exams,
            }
        )

    return (
        preview_rows,
        sorted(all_missing_exam_ids),
    )


# ============================================================
# STUDENT PREVIEW
# ============================================================

def calculate_student_preview(
    db: Session,
    student: Student,
    configuration: ResultConfiguration,
    exam_links: list[ResultConfigurationExam],
) -> dict[str, Any]:
    exam_ids = [
        link.exam_id
        for link in exam_links
    ]

    marks = load_marks_for_student(
        db=db,
        student_id=student.id,
        exam_ids=exam_ids,
    )

    exam_subjects = load_exam_subjects(
        db=db,
        exam_ids=exam_ids,
        class_id=student.class_id,
    )

    subjects, missing_exam_ids = (
        calculate_subject_preview(
            db=db,
            student=student,
            configuration=configuration,
            exam_links=exam_links,
            marks=marks,
            exam_subjects=exam_subjects,
        )
    )

    total_marks = sum(
        float(row["total_marks"])
        for row in subjects
    )

    max_marks = sum(
        float(row["max_marks"])
        for row in subjects
    )

    percentage = (
        (total_marks / max_marks) * 100
        if max_marks > 0
        else 0
    )

    grade = calculate_grade(
        percentage
    )

    compulsory_failed = any(
        not row["is_pass"]
        for row in subjects
    )

    is_pass = (
        bool(subjects)
        and not compulsory_failed
        and not missing_exam_ids
    )

    return {
        "student_id": student.id,
        "student_name": student_name(student),
        "subjects": subjects,
        "total_marks": round_value(
            total_marks
        ),
        "max_marks": round_value(
            max_marks
        ),
        "percentage": round_value(
            percentage
        ),
        "grade": grade,
        "rank": None,
        "is_pass": is_pass,
        "missing_marks": bool(
            missing_exam_ids
        ),
        "missing_exam_ids": missing_exam_ids,
    }


# ============================================================
# CONFIGURATION LOADING
# ============================================================

def get_configuration_or_404(
    db: Session,
    configuration_id: int,
) -> ResultConfiguration:
    configuration = (
        db.query(ResultConfiguration)
        .filter(
            ResultConfiguration.id
            == configuration_id
        )
        .first()
    )

    if not configuration:
        raise HTTPException(
            status_code=404,
            detail="Result configuration not found.",
        )

    return configuration


# ============================================================
# CREATE CONFIGURATION
# ============================================================

@router.post(
    "/configurations",
    response_model=ResultConfigurationResponse,
)
def create_configuration(
    payload: ResultConfigurationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    method = normalize_method(
        payload.calculation_method
    )

    if method == "BEST_OF" and not payload.best_of_count:
        raise HTTPException(
            status_code=400,
            detail=(
                "best_of_count is required "
                "for BEST_OF."
            ),
        )

    if method != "BEST_OF" and payload.best_of_count:
        raise HTTPException(
            status_code=400,
            detail=(
                "best_of_count is only allowed "
                "for BEST_OF calculation."
            ),
        )

    configuration = ResultConfiguration(
        name=payload.name.strip(),
        class_id=payload.class_id,
        academic_session_id=payload.academic_session_id,
        term=payload.term,
        calculation_method=method,
        best_of_count=payload.best_of_count,
        status="DRAFT",
        is_active=True,
    )

    db.add(configuration)
    db.flush()

    seen_exam_ids: set[int] = set()

    for item in payload.exams:
        if item.exam_id in seen_exam_ids:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Exam {item.exam_id} "
                    "was selected more than once."
                ),
            )

        seen_exam_ids.add(
            item.exam_id
        )

        exam = (
            db.query(Exam)
            .filter(
                Exam.id == item.exam_id
            )
            .first()
        )

        if not exam:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Exam {item.exam_id} "
                    "not found."
                ),
            )

        configuration.exams.append(
            ResultConfigurationExam(
                exam_id=item.exam_id,
                weightage=item.weightage,
                include_in_result=(
                    item.include_in_result
                ),
            )
        )

    db.commit()
    db.refresh(configuration)

    # Validate after persistence so the same validation
    # logic is also used by preview/generate.
    validate_configuration_exams(
        db,
        configuration,
    )

    return configuration


# ============================================================
# LIST CONFIGURATIONS
# ============================================================

@router.get(
    "/configurations",
    response_model=list[
        ResultConfigurationResponse
    ],
)
def list_configurations(
    class_id: int | None = Query(
        default=None
    ),
    status: str | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    query = db.query(
        ResultConfiguration
    )

    if class_id is not None:
        query = query.filter(
            ResultConfiguration.class_id
            == class_id
        )

    if status:
        status_value = status.upper()

        if status_value not in CONFIG_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid status '{status}'."
                ),
            )

        query = query.filter(
            ResultConfiguration.status
            == status_value
        )

    return (
        query
        .order_by(
            ResultConfiguration.created_at.desc()
        )
        .all()
    )


# ============================================================
# GET CONFIGURATION
# ============================================================

@router.get(
    "/configurations/{configuration_id}",
    response_model=ResultConfigurationResponse,
)
def get_configuration(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    return get_configuration_or_404(
        db,
        configuration_id,
    )


# ============================================================
# UPDATE CONFIGURATION
# ============================================================

@router.put(
    "/configurations/{configuration_id}",
    response_model=ResultConfigurationResponse,
)
def update_configuration(
    configuration_id: int,
    payload: ResultConfigurationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status in {
        "LOCKED",
        "PUBLISHED",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Locked or published result "
                "configuration cannot be modified."
            ),
        )

    if payload.name is not None:
        configuration.name = (
            payload.name.strip()
        )

    if payload.term is not None:
        configuration.term = payload.term

    if payload.calculation_method is not None:
        configuration.calculation_method = (
            normalize_method(
                payload.calculation_method
            )
        )

    if payload.best_of_count is not None:
        configuration.best_of_count = (
            payload.best_of_count
        )

    if payload.is_active is not None:
        configuration.is_active = (
            payload.is_active
        )

    method = normalize_method(
        configuration.calculation_method
    )

    if method == "BEST_OF":
        if not configuration.best_of_count:
            raise HTTPException(
                status_code=400,
                detail=(
                    "best_of_count is required "
                    "for BEST_OF."
                ),
            )
    else:
        configuration.best_of_count = None

    db.commit()
    db.refresh(configuration)

    return configuration


# ============================================================
# ADD EXAM TO CONFIGURATION
# ============================================================

@router.post(
    "/configurations/{configuration_id}/exams",
    response_model=ResultConfigurationResponse,
)
def add_exam_to_configuration(
    configuration_id: int,
    payload: ResultConfigurationExamCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status in {
        "LOCKED",
        "PUBLISHED",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Locked or published configuration "
                "cannot be modified."
            ),
        )

    exam = (
        db.query(Exam)
        .filter(
            Exam.id == payload.exam_id
        )
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found.",
        )

    existing = (
        db.query(
            ResultConfigurationExam
        )
        .filter(
            ResultConfigurationExam.configuration_id
            == configuration_id,
            ResultConfigurationExam.exam_id
            == payload.exam_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail=(
                "This exam is already selected "
                "for this result configuration."
            ),
        )

    configuration.exams.append(
        ResultConfigurationExam(
            exam_id=payload.exam_id,
            weightage=payload.weightage,
            include_in_result=(
                payload.include_in_result
            ),
        )
    )

    db.commit()
    db.refresh(configuration)

    return configuration


# ============================================================
# REMOVE EXAM FROM CONFIGURATION
# ============================================================

@router.delete(
    "/configurations/{configuration_id}/exams/{exam_id}",
    response_model=ResultConfigurationResponse,
)
def remove_exam_from_configuration(
    configuration_id: int,
    exam_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status in {
        "LOCKED",
        "PUBLISHED",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Locked or published configuration "
                "cannot be modified."
            ),
        )

    link = (
        db.query(
            ResultConfigurationExam
        )
        .filter(
            ResultConfigurationExam.configuration_id
            == configuration_id,
            ResultConfigurationExam.exam_id
            == exam_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail=(
                "Exam is not part of this "
                "result configuration."
            ),
        )

    db.delete(link)
    db.commit()
    db.refresh(configuration)

    return configuration


# ============================================================
# PREVIEW SINGLE STUDENT
# ============================================================

@router.get(
    "/configurations/{configuration_id}/preview/student/{student_id}",
    response_model=FinalResultPreview,
)
def preview_student_result(
    configuration_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if not configuration.is_active:
        raise HTTPException(
            status_code=400,
            detail=(
                "Result configuration is inactive."
            ),
        )

    exam_links = validate_configuration_exams(
        db,
        configuration,
    )

    student = (
        db.query(Student)
        .filter(
            Student.id == student_id
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    if student.class_id != configuration.class_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Student does not belong to "
                "the configured class."
            ),
        )

    result = calculate_student_preview(
        db=db,
        student=student,
        configuration=configuration,
        exam_links=exam_links,
    )

    return result
# ============================================================
# FINAL RESULT GENERATION HELPERS
# ============================================================

from app.models.final_result import (
    FinalResult,
    FinalResultSubject,
)


def calculate_rank(
    results: list[FinalResult],
) -> None:
    """
    Assign competition ranking.

    Example:
        98 -> 1
        95 -> 2
        95 -> 2
        91 -> 4
    """

    ordered = sorted(
        results,
        key=lambda item: float(item.percentage),
        reverse=True,
    )

    previous_percentage: float | None = None
    current_rank = 0

    for index, result in enumerate(ordered, start=1):
        percentage = float(
            result.percentage
        )

        if (
            previous_percentage is None
            or percentage != previous_percentage
        ):
            current_rank = index

        result.rank = current_rank

        previous_percentage = percentage


def get_active_class_students(
    db: Session,
    class_id: int,
) -> list[Student]:
    return (
        db.query(Student)
        .filter(
            Student.class_id == class_id,
            Student.is_active.is_(True),
        )
        .order_by(
            Student.first_name.asc(),
            Student.last_name.asc(),
        )
        .all()
    )


def create_final_result_snapshot(
    db: Session,
    configuration: ResultConfiguration,
    student: Student,
    preview: dict[str, Any],
) -> FinalResult:
    """
    Convert calculated preview into a persistent snapshot.

    The snapshot is intentionally separate from raw Marks.
    Once generated, it represents the result calculation
    at that point in time.
    """

    existing = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id,
            FinalResult.student_id
            == student.id,
        )
        .first()
    )

    if existing:
        if existing.is_locked or existing.is_published:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Final result for "
                    f"{student_name(student)} "
                    "is already locked/published."
                ),
            )

        final_result = existing

        # Remove old subject snapshot rows.
        for subject_row in list(
            final_result.subjects
        ):
            db.delete(subject_row)

        db.flush()

    else:
        final_result = FinalResult(
            configuration_id=configuration.id,
            student_id=student.id,
        )

        db.add(final_result)
        db.flush()

    final_result.total_marks = float(
        preview["total_marks"]
    )

    final_result.max_marks = float(
        preview["max_marks"]
    )

    final_result.percentage = float(
        preview["percentage"]
    )

    final_result.grade = str(
        preview["grade"]
    )

    final_result.rank = None

    final_result.is_pass = bool(
        preview["is_pass"]
    )

    final_result.is_locked = False
    final_result.is_published = False
    final_result.published_at = None

    for subject_data in preview["subjects"]:
        subject_snapshot = FinalResultSubject(
            final_result_id=final_result.id,
            subject_id=int(
                subject_data["subject_id"]
            ),
            total_marks=float(
                subject_data["total_marks"]
            ),
            max_marks=float(
                subject_data["max_marks"]
            ),
            percentage=float(
                subject_data["percentage"]
            ),
            grade=str(
                subject_data["grade"]
            ),
            is_pass=bool(
                subject_data["is_pass"]
            ),
        )

        db.add(subject_snapshot)

    db.flush()

    return final_result


# ============================================================
# GENERATE FINAL RESULTS
# ============================================================

@router.post(
    "/configurations/{configuration_id}/generate",
)
def generate_final_results(
    configuration_id: int,
    student_id: int | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if not configuration.is_active:
        raise HTTPException(
            status_code=400,
            detail=(
                "Result configuration is inactive."
            ),
        )

    if configuration.status in {
        "LOCKED",
        "PUBLISHED",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Locked or published configuration "
                "cannot be regenerated."
            ),
        )

    exam_links = validate_configuration_exams(
        db,
        configuration,
    )

    if student_id is not None:
        students = (
            db.query(Student)
            .filter(
                Student.id == student_id,
                Student.class_id
                == configuration.class_id,
                Student.is_active.is_(True),
            )
            .all()
        )

        if not students:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Active student not found "
                    "in the configured class."
                ),
            )

    else:
        students = get_active_class_students(
            db,
            configuration.class_id,
        )

    if not students:
        raise HTTPException(
            status_code=400,
            detail=(
                "No active students found "
                "in the configured class."
            ),
        )

    generated_results: list[
        FinalResult
    ] = []

    missing_students: list[dict[str, Any]] = []

    try:
        for student in students:
            preview = calculate_student_preview(
                db=db,
                student=student,
                configuration=configuration,
                exam_links=exam_links,
            )

            # Do not block generation on missing marks.
            # Instead, preserve the warning so admin can
            # review before locking.
            if preview["missing_marks"]:
                missing_students.append(
                    {
                        "student_id": student.id,
                        "student_name": student_name(
                            student
                        ),
                        "missing_exam_ids": preview[
                            "missing_exam_ids"
                        ],
                    }
                )

            final_result = (
                create_final_result_snapshot(
                    db=db,
                    configuration=configuration,
                    student=student,
                    preview=preview,
                )
            )

            generated_results.append(
                final_result
            )

        db.flush()

        # Rank must be calculated only after all students
        # in the same configuration have been generated.
        calculate_rank(
            generated_results
        )

        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to generate final results."
            ),
        ) from exc

    return {
        "configuration_id": configuration.id,
        "generated_count": len(
            generated_results
        ),
        "missing_marks_count": len(
            missing_students
        ),
        "missing_marks_students": (
            missing_students
        ),
        "status": configuration.status,
    }


# ============================================================
# GET GENERATED RESULTS
# ============================================================

@router.get(
    "/configurations/{configuration_id}/results",
)
def get_generated_results(
    configuration_id: int,
    student_id: int | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    query = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id
        )
    )

    if student_id is not None:
        query = query.filter(
            FinalResult.student_id
            == student_id
        )

    results = (
        query
        .order_by(
            FinalResult.rank.asc().nullslast(),
            FinalResult.percentage.desc(),
        )
        .all()
    )

    response = []

    for result in results:
        student = result.student

        response.append(
            {
                "id": result.id,
                "configuration_id": (
                    result.configuration_id
                ),
                "student_id": result.student_id,
                "student_name": (
                    student_name(student)
                    if student
                    else None
                ),
                "total_marks": (
                    result.total_marks
                ),
                "max_marks": (
                    result.max_marks
                ),
                "percentage": (
                    result.percentage
                ),
                "grade": result.grade,
                "rank": result.rank,
                "is_pass": result.is_pass,
                "is_locked": (
                    result.is_locked
                ),
                "is_published": (
                    result.is_published
                ),
                "published_at": (
                    result.published_at
                ),
                "subjects": [
                    {
                        "id": subject_row.id,
                        "subject_id": (
                            subject_row.subject_id
                        ),
                        "total_marks": (
                            subject_row.total_marks
                        ),
                        "max_marks": (
                            subject_row.max_marks
                        ),
                        "percentage": (
                            subject_row.percentage
                        ),
                        "grade": (
                            subject_row.grade
                        ),
                        "is_pass": (
                            subject_row.is_pass
                        ),
                    }
                    for subject_row
                    in result.subjects
                ],
            }
        )

    return {
        "configuration_id": (
            configuration.id
        ),
        "count": len(response),
        "results": response,
    }


# ============================================================
# GET SINGLE GENERATED RESULT
# ============================================================

@router.get(
    "/configurations/{configuration_id}/results/{student_id}",
)
def get_generated_student_result(
    configuration_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    result = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id,
            FinalResult.student_id
            == student_id,
        )
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail=(
                "Generated final result not found."
            ),
        )

    student = result.student

    return {
        "id": result.id,
        "configuration_id": (
            result.configuration_id
        ),
        "student_id": result.student_id,
        "student_name": (
            student_name(student)
            if student
            else None
        ),
        "total_marks": result.total_marks,
        "max_marks": result.max_marks,
        "percentage": result.percentage,
        "grade": result.grade,
        "rank": result.rank,
        "is_pass": result.is_pass,
        "is_locked": result.is_locked,
        "is_published": result.is_published,
        "published_at": result.published_at,
        "subjects": [
            {
                "id": subject_row.id,
                "subject_id": (
                    subject_row.subject_id
                ),
                "total_marks": (
                    subject_row.total_marks
                ),
                "max_marks": (
                    subject_row.max_marks
                ),
                "percentage": (
                    subject_row.percentage
                ),
                "grade": subject_row.grade,
                "is_pass": (
                    subject_row.is_pass
                ),
            }
            for subject_row
            in result.subjects
        ],
    }


# ============================================================
# REFRESH RANKS
# ============================================================

@router.post(
    "/configurations/{configuration_id}/recalculate-ranks",
)
def recalculate_ranks(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status in {
        "LOCKED",
        "PUBLISHED",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Ranks cannot be changed after "
                "the result is locked."
            ),
        )

    results = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id
        )
        .all()
    )

    if not results:
        raise HTTPException(
            status_code=400,
            detail=(
                "No generated results found."
            ),
        )

    calculate_rank(results)

    db.commit()

    return {
        "configuration_id": (
            configuration.id
        ),
        "updated_count": len(results),
        "status": "RANKS_UPDATED",
    }
# ============================================================
# MOVE CONFIGURATION TO REVIEW
# ============================================================

@router.post(
    "/configurations/{configuration_id}/review",
)
def move_configuration_to_review(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only DRAFT configurations "
                "can be moved to REVIEW."
            ),
        )

    results_count = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id
        )
        .count()
    )

    if results_count == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Generate final results before "
                "moving the configuration to REVIEW."
            ),
        )

    configuration.status = "REVIEW"

    db.commit()
    db.refresh(configuration)

    return {
        "configuration_id": configuration.id,
        "status": configuration.status,
    }


# ============================================================
# LOCK FINAL RESULTS
# ============================================================

@router.post(
    "/configurations/{configuration_id}/lock",
)
def lock_final_results(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status != "REVIEW":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only REVIEW configurations "
                "can be locked."
            ),
        )

    results = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id
        )
        .all()
    )

    if not results:
        raise HTTPException(
            status_code=400,
            detail=(
                "No generated final results "
                "found for this configuration."
            ),
        )

    # Do not allow locking while missing marks exist.
    missing_students = []

    for result in results:
        if not result.subjects:
            missing_students.append(
                result.student_id
            )

    if missing_students:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "Some students have no "
                    "subject result data."
                ),
                "student_ids": missing_students,
            },
        )

    for result in results:
        result.is_locked = True

    configuration.status = "LOCKED"

    db.commit()

    return {
        "configuration_id": configuration.id,
        "locked_count": len(results),
        "status": configuration.status,
    }


# ============================================================
# PUBLISH FINAL RESULTS
# ============================================================

@router.post(
    "/configurations/{configuration_id}/publish",
)
def publish_final_results(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status != "LOCKED":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only LOCKED configurations "
                "can be published."
            ),
        )

    results = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id
        )
        .all()
    )

    if not results:
        raise HTTPException(
            status_code=400,
            detail=(
                "No final results found."
            ),
        )

    now = datetime.utcnow()

    for result in results:
        if not result.is_locked:
            raise HTTPException(
                status_code=400,
                detail=(
                    "All final results must be "
                    "locked before publishing."
                ),
            )

    for result in results:
        result.is_published = True
        result.published_at = now

    configuration.status = "PUBLISHED"
    configuration.published_at = now

    db.commit()

    return {
        "configuration_id": configuration.id,
        "published_count": len(results),
        "published_at": now,
        "status": configuration.status,
    }


# ============================================================
# UNLOCK
# ============================================================

@router.post(
    "/configurations/{configuration_id}/unlock",
)
def unlock_final_results(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status != "LOCKED":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only LOCKED configurations "
                "can be unlocked."
            ),
        )

    results = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id
        )
        .all()
    )

    for result in results:
        result.is_locked = False

    configuration.status = "REVIEW"

    db.commit()

    return {
        "configuration_id": configuration.id,
        "status": configuration.status,
        "unlocked_count": len(results),
    }


# ============================================================
# STUDENT FINAL RESULT
# ============================================================

@router.get(
    "/student/me/configurations/{configuration_id}",
)
def get_my_final_result(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("student")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status != "PUBLISHED":
        raise HTTPException(
            status_code=404,
            detail=(
                "Final result has not been "
                "published yet."
            ),
        )

    student = (
        db.query(Student)
        .filter(
            Student.email == current_user.email,
            Student.class_id
            == configuration.class_id,
            Student.is_active.is_(True),
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail=(
                "Student profile not found."
            ),
        )

    result = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id,
            FinalResult.student_id
            == student.id,
            FinalResult.is_published.is_(True),
        )
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail=(
                "Published final result not found."
            ),
        )

    return {
        "configuration": {
            "id": configuration.id,
            "name": configuration.name,
            "term": configuration.term,
            "status": configuration.status,
        },
        "student": {
            "id": student.id,
            "name": student_name(student),
            "admission_number": (
                student.admission_number
            ),
        },
        "result": {
            "id": result.id,
            "total_marks": result.total_marks,
            "max_marks": result.max_marks,
            "percentage": result.percentage,
            "grade": result.grade,
            "rank": result.rank,
            "is_pass": result.is_pass,
            "subjects": [
                {
                    "subject_id": (
                        row.subject_id
                    ),
                    "total_marks": (
                        row.total_marks
                    ),
                    "max_marks": (
                        row.max_marks
                    ),
                    "percentage": (
                        row.percentage
                    ),
                    "grade": row.grade,
                    "is_pass": row.is_pass,
                }
                for row in result.subjects
            ],
        },
    }


# ============================================================
# PARENT FINAL RESULT
# ============================================================

@router.get(
    "/parent/children/{student_id}/configurations/{configuration_id}",
)
def get_parent_child_final_result(
    student_id: int,
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("parent")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    if configuration.status != "PUBLISHED":
        raise HTTPException(
            status_code=404,
            detail=(
                "Final result has not been "
                "published yet."
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
            detail="Student not found.",
        )

    # Import here to avoid unnecessary model coupling
    # during application startup.
    from app.models.parent import Parent
    from app.models.parent_child import ParentChild

    parent = (
        db.query(Parent)
        .filter(
            Parent.email == current_user.email
        )
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent profile not found.",
        )

    parent_link = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id
            == parent.id,
            ParentChild.student_id
            == student.id,
        )
        .first()
    )

    if not parent_link:
        raise HTTPException(
            status_code=403,
            detail=(
                "You are not authorized to "
                "view this student's result."
            ),
        )

    result = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id,
            FinalResult.student_id
            == student.id,
            FinalResult.is_published.is_(True),
        )
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail=(
                "Published final result not found."
            ),
        )

    return {
        "configuration": {
            "id": configuration.id,
            "name": configuration.name,
            "term": configuration.term,
            "status": configuration.status,
        },
        "student": {
            "id": student.id,
            "name": student_name(student),
            "admission_number": (
                student.admission_number
            ),
        },
        "result": {
            "id": result.id,
            "total_marks": result.total_marks,
            "max_marks": result.max_marks,
            "percentage": result.percentage,
            "grade": result.grade,
            "rank": result.rank,
            "is_pass": result.is_pass,
            "subjects": [
                {
                    "subject_id": (
                        row.subject_id
                    ),
                    "total_marks": (
                        row.total_marks
                    ),
                    "max_marks": (
                        row.max_marks
                    ),
                    "percentage": (
                        row.percentage
                    ),
                    "grade": row.grade,
                    "is_pass": row.is_pass,
                }
                for row in result.subjects
            ],
        },
    }


# ============================================================
# ADMIN RESULT STATISTICS
# ============================================================

@router.get(
    "/configurations/{configuration_id}/statistics",
)
def get_result_statistics(
    configuration_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role("admin")
    ),
):
    configuration = get_configuration_or_404(
        db,
        configuration_id,
    )

    results = (
        db.query(FinalResult)
        .filter(
            FinalResult.configuration_id
            == configuration.id
        )
        .all()
    )

    if not results:
        return {
            "configuration_id": configuration.id,
            "total_students": 0,
            "passed": 0,
            "failed": 0,
            "pass_percentage": 0,
            "average_percentage": 0,
            "highest_percentage": 0,
            "lowest_percentage": 0,
            "grade_distribution": {},
        }

    passed = sum(
        1
        for result in results
        if result.is_pass
    )

    failed = (
        len(results) - passed
    )

    percentages = [
        float(result.percentage)
        for result in results
    ]

    grade_distribution: dict[
        str,
        int,
    ] = defaultdict(int)

    for result in results:
        grade_distribution[
            result.grade
        ] += 1

    return {
        "configuration_id": configuration.id,
        "total_students": len(results),
        "passed": passed,
        "failed": failed,
        "pass_percentage": round_value(
            (passed / len(results)) * 100
        ),
        "average_percentage": round_value(
            sum(percentages)
            / len(percentages)
        ),
        "highest_percentage": round_value(
            max(percentages)
        ),
        "lowest_percentage": round_value(
            min(percentages)
        ),
        "grade_distribution": dict(
            sorted(
                grade_distribution.items()
            )
        ),
    }