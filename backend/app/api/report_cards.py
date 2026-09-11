from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission

from app.models.attendance import Attendance
from app.models.exam import Exam
from app.models.exam_subject import ExamSubject
from app.models.final_result import FinalResult
from app.models.mark import Mark
from app.models.report_card_template import ReportCardTemplate
from app.models.school_class import SchoolClass
from app.models.student import Student
from app.models.subject import Subject

from app.schemas.report_card import (
    ReportCardAcademicSubject,
    ReportCardAttendance,
    ReportCardCoScholasticItem,
    ReportCardResponse,
    ReportCardResultSummary,
    ReportCardStudentResponse,
)

router = APIRouter(
    prefix="/report-cards",
    tags=["Report Cards"],
)


# ============================================================
# GENERIC HELPERS
# ============================================================

def _safe_value(
    obj: Any,
    *names: str,
    default=None,
):
    if obj is None:
        return default

    for name in names:
        try:
            if hasattr(obj, name):
                value = getattr(obj, name)

                if value is not None:
                    return value
        except Exception:
            continue

    return default


def _to_float(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _serialize_date(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return str(value)


def _calculate_percentage(
    obtained: float | None,
    maximum: float | None,
) -> float | None:
    if obtained is None:
        return None

    if maximum is None or maximum <= 0:
        return None

    return round((obtained / maximum) * 100, 2)


def _calculate_grade(
    percentage: float | None,
) -> str | None:
    if percentage is None:
        return None

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


def _calculate_remark(
    percentage: float | None,
    is_pass: bool | None,
) -> str | None:
    if percentage is None:
        return "Not Assessed"

    if is_pass is False:
        return "Needs Improvement"

    if percentage >= 90:
        return "Outstanding"

    if percentage >= 80:
        return "Excellent"

    if percentage >= 70:
        return "Very Good"

    if percentage >= 60:
        return "Good"

    if percentage >= 50:
        return "Satisfactory"

    if percentage >= 40:
        return "Pass"

    return "Needs Improvement"


# ============================================================
# STUDENT HELPERS
# ============================================================

def _student_name(student: Student) -> str:
    first_name = _safe_value(
        student,
        "first_name",
        "firstName",
        default="",
    )

    last_name = _safe_value(
        student,
        "last_name",
        "lastName",
        default="",
    )

    full_name = " ".join(
        str(part).strip()
        for part in [first_name, last_name]
        if part is not None and str(part).strip()
    )

    if full_name:
        return full_name

    return str(
        _safe_value(
            student,
            "name",
            "full_name",
            default=f"Student #{student.id}",
        )
    )


def _student_father_name(
    student: Student,
) -> str | None:
    value = _safe_value(
        student,
        "father_name",
        "fatherName",
        "father",
        "guardian_name",
        default=None,
    )

    return str(value) if value is not None else None


def _student_mother_name(
    student: Student,
) -> str | None:
    value = _safe_value(
        student,
        "mother_name",
        "motherName",
        "mother",
        default=None,
    )

    return str(value) if value is not None else None


def _student_admission_number(
    student: Student,
) -> str | None:
    value = _safe_value(
        student,
        "admission_number",
        "admission_no",
        "admissionNumber",
        "registration_number",
        default=None,
    )

    return str(value) if value is not None else None


def _student_roll_number(
    student: Student,
) -> str | None:
    value = _safe_value(
        student,
        "roll_no",
        "roll_number",
        "rollNumber",
        "roll",
        default=None,
    )

    return str(value) if value is not None else None


def _student_section(
    student: Student,
) -> str | None:
    value = _safe_value(
        student,
        "section",
        "section_name",
        default=None,
    )

    if value is not None:
        return str(value)

    enrollment = _safe_value(
        student,
        "enrollment",
        "current_enrollment",
        default=None,
    )

    if enrollment:
        value = _safe_value(
            enrollment,
            "section",
            "section_name",
            default=None,
        )

        if value is not None:
            return str(value)

    return None


# ============================================================
# TEMPLATE SELECTION
# ============================================================

def _template_score(
    template: ReportCardTemplate,
    *,
    class_id: int | None,
    exam_id: int | None,
) -> tuple[int, int, int, int]:
    """
    Higher score = better template.

    Priority:
    1. exact class
    2. exact exam
    3. default
    4. newest
    """

    template_class_id = template.class_id
    template_exam_id = template.exam_id

    class_score = 0
    exam_score = 0

    if class_id is not None:
        if template_class_id == class_id:
            class_score = 100
        elif template_class_id is None:
            class_score = 50

    else:
        if template_class_id is None:
            class_score = 50

    if exam_id is not None:
        if template_exam_id == exam_id:
            exam_score = 100
        elif template_exam_id is None:
            exam_score = 50

    else:
        if template_exam_id is None:
            exam_score = 50

    default_score = 10 if template.is_default else 0

    template_id_score = int(template.id or 0)

    return (
        class_score,
        exam_score,
        default_score,
        template_id_score,
    )


def _get_template(
    db: Session,
    student: Student,
    template_id: int | None,
    exam_id: int | None,
) -> ReportCardTemplate:
    # --------------------------------------------------------
    # Explicit template
    # --------------------------------------------------------

    if template_id is not None:
        template = (
            db.query(ReportCardTemplate)
            .filter(
                ReportCardTemplate.id == template_id,
            )
            .first()
        )

        if template is None:
            raise HTTPException(
                status_code=404,
                detail="Report card template not found.",
            )

        return template

    class_id = _safe_value(
        student,
        "class_id",
        default=None,
    )

    # --------------------------------------------------------
    # Get all active candidates
    # --------------------------------------------------------

    templates = (
        db.query(ReportCardTemplate)
        .order_by(
            ReportCardTemplate.is_default.desc(),
            ReportCardTemplate.updated_at.desc(),
            ReportCardTemplate.id.desc(),
        )
        .all()
    )

    if not templates:
        raise HTTPException(
            status_code=404,
            detail="No report card template has been created yet.",
        )

    # --------------------------------------------------------
    # Prefer matching templates
    # --------------------------------------------------------

    candidates: list[ReportCardTemplate] = []

    for template in templates:
        class_matches = (
            template.class_id is None
            or template.class_id == class_id
        )

        exam_matches = (
            exam_id is None
            or template.exam_id is None
            or template.exam_id == exam_id
        )

        if class_matches and exam_matches:
            candidates.append(template)

    # --------------------------------------------------------
    # If no candidate, use global default
    # --------------------------------------------------------

    if not candidates:
        global_default = (
            db.query(ReportCardTemplate)
            .filter(
                ReportCardTemplate.class_id.is_(None),
                ReportCardTemplate.academic_session_id.is_(None),
                ReportCardTemplate.exam_id.is_(None),
                ReportCardTemplate.is_default.is_(True),
            )
            .order_by(
                ReportCardTemplate.updated_at.desc(),
                ReportCardTemplate.id.desc(),
            )
            .first()
        )

        if global_default:
            return global_default

        return templates[0]

    # --------------------------------------------------------
    # Sort by exact scope
    # --------------------------------------------------------

    candidates.sort(
        key=lambda template: _template_score(
            template,
            class_id=class_id,
            exam_id=exam_id,
        ),
        reverse=True,
    )

    return candidates[0]


# ============================================================
# EXAM
# ============================================================

def _get_exam(
    db: Session,
    exam_id: int | None,
    template: ReportCardTemplate,
) -> Exam | None:
    selected_exam_id = exam_id

    if selected_exam_id is None:
        selected_exam_id = template.exam_id

    if selected_exam_id is None:
        return None

    exam = (
        db.query(Exam)
        .filter(
            Exam.id == selected_exam_id,
        )
        .first()
    )

    if exam is None:
        raise HTTPException(
            status_code=404,
            detail="Exam not found.",
        )

    return exam


# ============================================================
# ACADEMIC SUBJECTS
# ============================================================

def _get_academic_subjects(
    db: Session,
    student: Student,
    exam: Exam | None,
    template: ReportCardTemplate,
) -> list[ReportCardAcademicSubject]:
    class_id = _safe_value(
        student,
        "class_id",
        default=None,
    )

    if class_id is None or exam is None:
        return []

    exam_subjects = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == exam.id,
            ExamSubject.class_id == class_id,
        )
        .all()
    )

    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student.id,
            Mark.exam_id == exam.id,
        )
        .all()
    )

    marks_by_subject = {
        mark.subject_id: mark
        for mark in marks
    }

    subject_ids = [
        item.subject_id
        for item in exam_subjects
    ]

    subjects = []

    if subject_ids:
        subjects = (
            db.query(Subject)
            .filter(
                Subject.id.in_(subject_ids),
            )
            .all()
        )

    subject_map = {
        subject.id: subject
        for subject in subjects
    }

    result: list[ReportCardAcademicSubject] = []

    for exam_subject in exam_subjects:
        subject = subject_map.get(
            exam_subject.subject_id
        )

        if subject is None:
            continue

        mark = marks_by_subject.get(
            exam_subject.subject_id
        )

        max_marks = (
            _to_float(
                _safe_value(
                    exam_subject,
                    "max_marks",
                    default=0,
                )
            )
            or 0
        )

        pass_marks = (
            _to_float(
                _safe_value(
                    exam_subject,
                    "pass_marks",
                    default=0,
                )
            )
            or 0
        )

        marks_obtained = None

        if mark is not None:
            marks_obtained = _to_float(
                mark.marks_obtained
            )

        percentage = _calculate_percentage(
            marks_obtained,
            max_marks,
        )

        is_pass = None

        if marks_obtained is not None:
            is_pass = marks_obtained >= pass_marks

        result.append(
            ReportCardAcademicSubject(
                subject_id=subject.id,
                subject_name=str(
                    _safe_value(
                        subject,
                        "name",
                        default="",
                    )
                ),
                subject_code=_safe_value(
                    subject,
                    "code",
                    default=None,
                ),
                max_marks=max_marks,
                pass_marks=pass_marks,
                marks_obtained=marks_obtained,
                percentage=percentage,
                grade=_calculate_grade(
                    percentage
                ),
                remark=_calculate_remark(
                    percentage,
                    is_pass,
                ),
                is_optional=bool(
                    _safe_value(
                        exam_subject,
                        "is_optional",
                        default=False,
                    )
                ),
                include_in_result=bool(
                    _safe_value(
                        exam_subject,
                        "include_in_result",
                        default=True,
                    )
                ),
                is_pass=is_pass,
            )
        )

    # --------------------------------------------------------
    # Respect saved template subject order
    # Supports:
    # settings.academic.subjects
    # settings.academic_subjects
    # --------------------------------------------------------

    settings = template.settings or {}

    configured = settings.get(
        "academic_subjects",
        None,
    )

    if configured is None:
        academic_settings = settings.get(
            "academic",
            {}
        )

        if isinstance(academic_settings, dict):
            configured = academic_settings.get(
                "subjects",
                [],
            )

    if isinstance(configured, list):
        order: dict[int, int] = {}

        for index, item in enumerate(configured):
            if not isinstance(item, dict):
                continue

            subject_id = item.get(
                "subject_id"
            )

            if subject_id is None:
                continue

            try:
                order[int(subject_id)] = index
            except (TypeError, ValueError):
                continue

        if order:
            result.sort(
                key=lambda item: order.get(
                    item.subject_id,
                    999999,
                )
            )

    return result


# ============================================================
# RESULT
# ============================================================

def _calculate_result_summary(
    subjects: list[ReportCardAcademicSubject],
) -> ReportCardResultSummary:
    included = [
        item
        for item in subjects
        if item.include_in_result
    ]

    if not included:
        included = subjects

    if not included:
        return ReportCardResultSummary()

    marked = [
        item
        for item in included
        if item.marks_obtained is not None
    ]

    if not marked:
        return ReportCardResultSummary()

    total_marks = round(
        sum(
            item.marks_obtained or 0
            for item in included
        ),
        2,
    )

    max_marks = round(
        sum(
            item.max_marks
            for item in included
        ),
        2,
    )

    percentage = _calculate_percentage(
        total_marks,
        max_marks,
    )

    failed = [
        item
        for item in included
        if item.is_pass is False
    ]

    is_pass = (
        len(failed) == 0
        if marked
        else None
    )

    return ReportCardResultSummary(
        total_marks=total_marks,
        max_marks=max_marks,
        percentage=percentage,
        grade=_calculate_grade(
            percentage
        ),
        rank=None,
        is_pass=is_pass,
    )


def _get_final_result(
    db: Session,
    student_id: int,
) -> FinalResult | None:
    return (
        db.query(FinalResult)
        .filter(
            FinalResult.student_id == student_id,
        )
        .order_by(
            FinalResult.id.desc(),
        )
        .first()
    )


# ============================================================
# ATTENDANCE
# ============================================================

def _get_attendance(
    db: Session,
    student_id: int,
) -> ReportCardAttendance:
    rows = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student_id,
        )
        .all()
    )

    total_days = len(rows)
    present_days = 0
    absent_days = 0

    for row in rows:
        status = _safe_value(
            row,
            "status",
            "attendance_status",
            default="",
        )

        value = str(status).strip().upper()

        if value in {
            "P",
            "PRESENT",
            "1",
            "TRUE",
        }:
            present_days += 1

        elif value in {
            "A",
            "ABSENT",
            "0",
            "FALSE",
        }:
            absent_days += 1

    percentage = None

    if total_days > 0:
        percentage = round(
            (present_days / total_days) * 100,
            2,
        )

    return ReportCardAttendance(
        total_days=total_days,
        present_days=present_days,
        absent_days=absent_days,
        percentage=percentage,
    )


# ============================================================
# CO-SCHOLASTIC
# ============================================================

def _get_co_scholastic(
    template: ReportCardTemplate,
) -> list[ReportCardCoScholasticItem]:
    settings = template.settings or {}

    configured = settings.get(
        "co_scholastic_subjects",
        None,
    )

    if configured is None:
        co_settings = settings.get(
            "co_scholastic",
            {},
        )

        if isinstance(co_settings, dict):
            configured = co_settings.get(
                "subjects",
                [],
            )

    if not isinstance(configured, list):
        return []

    result = []

    for item in configured:
        if isinstance(item, str):
            result.append(
                ReportCardCoScholasticItem(
                    name=item,
                    value=None,
                    grade=None,
                    remark=None,
                )
            )
            continue

        if not isinstance(item, dict):
            continue

        name = (
            item.get("name")
            or item.get("subject_name")
            or item.get("label")
            or item.get("subject")
        )

        if not name:
            continue

        result.append(
            ReportCardCoScholasticItem(
                name=str(name),
                value=(
                    str(item["value"])
                    if item.get("value") is not None
                    else None
                ),
                grade=(
                    str(item["grade"])
                    if item.get("grade") is not None
                    else None
                ),
                remark=(
                    str(item["remark"])
                    if item.get("remark") is not None
                    else None
                ),
            )
        )

    return result


# ============================================================
# ACADEMIC SESSION
# ============================================================

def _get_academic_session(
    db: Session,
    template: ReportCardTemplate,
):
    session_id = template.academic_session_id

    if session_id is None:
        return None

    try:
        from app.models.academic_session import AcademicSession

        return (
            db.query(AcademicSession)
            .filter(
                AcademicSession.id == session_id,
            )
            .first()
        )
    except Exception:
        return None


# ============================================================
# MAIN REPORT CARD
# ============================================================

@router.get(
    "/student/{student_id}",
    response_model=ReportCardResponse,
)
def get_student_report_card(
    student_id: int,
    template_id: int | None = Query(
        default=None
    ),
    exam_id: int | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission(
            "report_cards.view"
        )
    ),
):
    # --------------------------------------------------------
    # STUDENT
    # --------------------------------------------------------

    student = (
        db.query(Student)
        .filter(
            Student.id == student_id,
        )
        .first()
    )

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    class_id = _safe_value(
        student,
        "class_id",
        default=None,
    )

    school_class = None

    if class_id is not None:
        school_class = (
            db.query(SchoolClass)
            .filter(
                SchoolClass.id == class_id,
            )
            .first()
        )

    # --------------------------------------------------------
    # TEMPLATE
    # --------------------------------------------------------

    template = _get_template(
        db,
        student,
        template_id,
        exam_id,
    )

    # --------------------------------------------------------
    # EXAM
    # --------------------------------------------------------

    exam = _get_exam(
        db,
        exam_id,
        template,
    )

    # --------------------------------------------------------
    # ACADEMIC SESSION
    # --------------------------------------------------------

    academic_session = _get_academic_session(
        db,
        template,
    )

    # --------------------------------------------------------
    # ACADEMIC SUBJECTS
    # --------------------------------------------------------

    academic_subjects = _get_academic_subjects(
        db,
        student,
        exam,
        template,
    )

    # --------------------------------------------------------
    # RESULT
    # --------------------------------------------------------

    final_result = _get_final_result(
        db,
        student.id,
    )

    calculated_result = (
        _calculate_result_summary(
            academic_subjects
        )
    )

    if final_result is not None:
        result = ReportCardResultSummary(
            total_marks=_to_float(
                _safe_value(
                    final_result,
                    "total_marks",
                )
            ),
            max_marks=_to_float(
                _safe_value(
                    final_result,
                    "max_marks",
                )
            ),
            percentage=_to_float(
                _safe_value(
                    final_result,
                    "percentage",
                )
            ),
            grade=_safe_value(
                final_result,
                "grade",
            ),
            rank=_safe_value(
                final_result,
                "rank",
            ),
            is_pass=_safe_value(
                final_result,
                "is_pass",
            ),
        )

        # If stored final result is incomplete,
        # use calculated exam result.
        if (
            result.total_marks is None
            and result.percentage is None
        ):
            result = calculated_result

    else:
        result = calculated_result

    # --------------------------------------------------------
    # STUDENT RESPONSE
    # --------------------------------------------------------

    class_name = None

    if school_class is not None:
        class_name = _safe_value(
            school_class,
            "name",
            "class_name",
            default=None,
        )

    student_response = ReportCardStudentResponse(
        id=student.id,
        admission_number=(
            _student_admission_number(student)
        ),
        name=_student_name(student),
        first_name=_safe_value(
            student,
            "first_name",
            default=None,
        ),
        last_name=_safe_value(
            student,
            "last_name",
            default=None,
        ),
        father_name=_student_father_name(
            student
        ),
        mother_name=_student_mother_name(
            student
        ),
        class_id=class_id,
        class_name=class_name,
        section=_student_section(student),
        roll_no=_student_roll_number(student),
        academic_session=(
            _safe_value(
                academic_session,
                "name",
                "session_name",
                "academic_year",
                default=None,
            )
            if academic_session
            else None
        ),
    )

    # --------------------------------------------------------
    # EXAM RESPONSE
    # --------------------------------------------------------

    exam_payload = None

    if exam is not None:
        exam_payload = {
            "id": exam.id,
            "name": _safe_value(
                exam,
                "name",
            ),
            "description": _safe_value(
                exam,
                "description",
            ),
            "exam_type": _safe_value(
                exam,
                "exam_type",
            ),
            "academic_year": _safe_value(
                exam,
                "academic_year",
            ),
            "term": _safe_value(
                exam,
                "term",
            ),
            "start_date": _serialize_date(
                _safe_value(
                    exam,
                    "start_date",
                )
            ),
            "end_date": _serialize_date(
                _safe_value(
                    exam,
                    "end_date",
                )
            ),
        }

    # --------------------------------------------------------
    # ACADEMIC SESSION RESPONSE
    # --------------------------------------------------------

    academic_session_payload = None

    if academic_session is not None:
        academic_session_payload = {
            "id": academic_session.id,
            "name": _safe_value(
                academic_session,
                "name",
                "session_name",
            ),
            "academic_year": _safe_value(
                academic_session,
                "academic_year",
            ),
            "start_date": _serialize_date(
                _safe_value(
                    academic_session,
                    "start_date",
                )
            ),
            "end_date": _serialize_date(
                _safe_value(
                    academic_session,
                    "end_date",
                )
            ),
        }

    # --------------------------------------------------------
    # TEMPLATE RESPONSE
    # IMPORTANT:
    # elements + settings are returned exactly.
    # --------------------------------------------------------

    template_payload = {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "class_id": template.class_id,
        "academic_session_id": template.academic_session_id,
        "exam_id": (
            template.exam_id
            if template.exam_id is not None
            else (
                exam.id
                if exam is not None
                else None
            )
        ),
        "page_size": template.page_size or "A4",
        "orientation": (
            template.orientation or "portrait"
        ),
        "status": template.status or "DRAFT",
        "is_default": bool(
            template.is_default
        ),
        "elements": (
            template.elements
            if isinstance(
                template.elements,
                list,
            )
            else []
        ),
        "settings": (
            template.settings
            if isinstance(
                template.settings,
                dict,
            )
            else {}
        ),
    }

    # --------------------------------------------------------
    # ATTENDANCE
    # --------------------------------------------------------

    attendance = _get_attendance(
        db,
        student.id,
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return ReportCardResponse(
        template=template_payload,
        student=student_response,
        exam=exam_payload,
        academic_session=academic_session_payload,
        academic_subjects=academic_subjects,
        co_scholastic=_get_co_scholastic(
            template
        ),
        result=result,
        attendance=attendance,
        class_teacher_remark=None,
        principal_remark=None,
    )

# ============================================================
# BULK REPORT CARDS
# ============================================================

@router.get(
    "/bulk",
)
def get_bulk_report_cards(
    class_id: int | None = Query(default=None),
    section: str | None = Query(default=None),
    exam_id: int | None = Query(default=None),
    template_id: int | None = Query(default=None),
    student_ids: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission(
            "report_cards.view"
        )
    ),
):
    query = db.query(Student)

    if class_id is not None:
        query = query.filter(
            Student.class_id == class_id
        )

    students = query.all()

    requested_ids: set[int] | None = None
    if student_ids:
        requested_ids = set()
        for raw_id in student_ids.split(","):
            raw_id = raw_id.strip()
            if not raw_id:
                continue
            try:
                requested_ids.add(int(raw_id))
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid student id: {raw_id}",
                )

    if requested_ids is not None:
        students = [
            student
            for student in students
            if student.id in requested_ids
        ]

    if section is not None and section.strip():
        wanted_section = section.strip().lower()
        students = [
            student
            for student in students
            if (
                _student_section(student)
                or ""
            ).strip().lower()
            == wanted_section
        ]

    def sort_key(student: Student):
        roll = _student_roll_number(student)
        if roll is None:
            return (1, "", _student_name(student).lower(), student.id)
        return (0, str(roll).lower(), _student_name(student).lower(), student.id)

    students.sort(key=sort_key)

    reports = []

    for student in students:
        report = get_student_report_card(
            student_id=student.id,
            template_id=template_id,
            exam_id=exam_id,
            db=db,
            current_user=current_user,
        )
        reports.append(report.model_dump())

    return {
        "count": len(reports),
        "students": [
            {
                "id": student.id,
                "name": _student_name(student),
                "roll_no": _student_roll_number(student),
                "section": _student_section(student),
                "class_id": _safe_value(
                    student,
                    "class_id",
                    default=None,
                ),
            }
            for student in students
        ],
        "reports": reports,
    }
