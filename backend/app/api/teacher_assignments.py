from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models import (
    Exam,
    ExamSubject,
    Mark,
    SchoolSection,
    SectionSubjectTeacher,
    Student,
    Subject,
    Teacher,
    User,
)

router = APIRouter(
    prefix="/teacher",
    tags=["Teacher Assessments"],
)

EDITABLE_EXAM_STATUSES = {"DRAFT", "ACTIVE"}


def _teacher_or_403(db: Session, current_user: User) -> Teacher:
    if str(getattr(current_user, "role", "") or "").lower() != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is available only to teacher accounts.",
        )

    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active teacher profile not found.",
        )

    return teacher


def _section_or_403(
    db: Session,
    teacher: Teacher,
    section_id: int,
) -> SchoolSection:
    section = (
        db.query(SchoolSection)
        .filter(
            SchoolSection.id == section_id,
            SchoolSection.is_active.is_(True),
        )
        .first()
    )

    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found or inactive.",
        )

    assignment = (
        db.query(SectionSubjectTeacher.id)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher.id,
            SectionSubjectTeacher.section_id == section_id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this section.",
        )

    return section


def _subject_assignment_or_403(
    db: Session,
    teacher: Teacher,
    section_id: int,
    subject_id: int,
) -> SectionSubjectTeacher:
    assignment = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher.id,
            SectionSubjectTeacher.section_id == section_id,
            SectionSubjectTeacher.subject_id == subject_id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this section and subject.",
        )

    return assignment


@router.get("/me/assessment-options")
def get_my_assessment_options(
    section_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the examinations and subject configurations a teacher can work on.

    A teacher sees only:
      - sections where the teacher has an active subject assignment;
      - subjects assigned to that teacher in the selected section;
      - exam/subject configurations that exist for the section's class.
    """
    teacher = _teacher_or_403(db, current_user)

    mapping_query = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher.id,
            SectionSubjectTeacher.is_active.is_(True),
        )
    )

    if section_id is not None:
        mapping_query = mapping_query.filter(
            SectionSubjectTeacher.section_id == section_id
        )

    mappings = mapping_query.all()

    if section_id is not None:
        _section_or_403(db, teacher, section_id)

    if not mappings:
        return {
            "sections": [],
            "exams": [],
            "subjects": [],
        }

    section_ids = {mapping.section_id for mapping in mappings}
    subject_ids = {mapping.subject_id for mapping in mappings}

    sections = (
        db.query(SchoolSection)
        .filter(
            SchoolSection.id.in_(section_ids),
            SchoolSection.is_active.is_(True),
        )
        .all()
    )
    sections_by_id = {row.id: row for row in sections}

    subjects = (
        db.query(Subject)
        .filter(
            Subject.id.in_(subject_ids),
            Subject.is_active.is_(True),
        )
        .all()
    )
    subjects_by_id = {row.id: row for row in subjects}

    # Fetch every configured exam-subject pair for the classes represented
    # by the teacher's active section-level assignments.
    class_ids = {
        section.class_id
        for section in sections_by_id.values()
    }

    config_rows = (
        db.query(ExamSubject, Exam)
        .join(Exam, Exam.id == ExamSubject.exam_id)
        .filter(
            ExamSubject.class_id.in_(class_ids),
            ExamSubject.subject_id.in_(subject_ids),
            Exam.is_active.is_(True),
        )
        .all()
    )

    mapping_pairs = {
        (mapping.section_id, mapping.subject_id)
        for mapping in mappings
    }

    section_subject_map: dict[
        tuple[int, int], list[dict]
    ] = {}
    exam_map: dict[int, dict] = {}

    for config, exam in config_rows:
        exam_status = str(
            getattr(exam, "status", "") or ""
        ).upper()

        exam_map[exam.id] = {
            "id": exam.id,
            "name": exam.name,
            "description": getattr(exam, "description", None),
            "exam_type": getattr(exam, "exam_type", None),
            "academic_year": getattr(exam, "academic_year", None),
            "term": getattr(exam, "term", None),
            "start_date": (
                exam.start_date.isoformat()
                if getattr(exam, "start_date", None)
                else None
            ),
            "end_date": (
                exam.end_date.isoformat()
                if getattr(exam, "end_date", None)
                else None
            ),
            "status": exam_status,
            "is_editable": exam_status in EDITABLE_EXAM_STATUSES,
        }

        subject = subjects_by_id.get(config.subject_id)
        if subject is None:
            continue

        for mapping_section_id, mapping_subject_id in mapping_pairs:
            if mapping_subject_id != config.subject_id:
                continue

            section = sections_by_id.get(mapping_section_id)
            if section is None or section.class_id != config.class_id:
                continue

            section_subject_map.setdefault(
                (mapping_section_id, mapping_subject_id),
                [],
            ).append(
                {
                    "section_id": mapping_section_id,
                    "section_name": section.name,
                    "class_id": section.class_id,
                    "subject_id": subject.id,
                    "subject_name": subject.name,
                    "subject_code": getattr(subject, "code", None),
                    "exam_id": exam.id,
                    "exam_name": exam.name,
                    "exam_status": exam_status,
                    "is_editable": exam_status in EDITABLE_EXAM_STATUSES,
                    "max_marks": float(config.max_marks),
                    "pass_marks": float(config.pass_marks),
                    "is_optional": bool(
                        getattr(config, "is_optional", False)
                    ),
                    "include_in_result": bool(
                        getattr(config, "include_in_result", True)
                    ),
                }
            )

    subject_options = [
        item
        for items in section_subject_map.values()
        for item in items
    ]

    subject_options.sort(
        key=lambda item: (
            item["section_name"].lower(),
            item["subject_name"].lower(),
            item["exam_name"].lower(),
        )
    )

    section_payload = [
        {
            "id": section.id,
            "class_id": section.class_id,
            "name": section.name,
        }
        for section in sorted(
            sections_by_id.values(),
            key=lambda row: (row.name.lower(), row.id),
        )
    ]

    exam_payload = sorted(
        exam_map.values(),
        key=lambda item: (
            item["start_date"] or "",
            item["id"],
        ),
        reverse=True,
    )

    return {
        "sections": section_payload,
        "exams": exam_payload,
        "subjects": subject_options,
    }


@router.get("/sections/{section_id}/assessments")
def get_section_assessment_register(
    section_id: int,
    exam_id: int,
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the mark register for one teacher-owned section + subject + exam.
    """
    teacher = _teacher_or_403(db, current_user)
    section = _section_or_403(db, teacher, section_id)
    _subject_assignment_or_403(
        db,
        teacher,
        section_id,
        subject_id,
    )

    subject = (
        db.query(Subject)
        .filter(
            Subject.id == subject_id,
            Subject.is_active.is_(True),
        )
        .first()
    )
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found or inactive.",
        )

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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found or inactive.",
        )

    exam_status = str(
        getattr(exam, "status", "") or ""
    ).upper()

    config = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == exam_id,
            ExamSubject.class_id == section.class_id,
            ExamSubject.subject_id == subject_id,
        )
        .first()
    )

    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This subject is not configured for the selected "
                "exam and class."
            ),
        )

    students = (
        db.query(Student)
        .filter(
            Student.section_id == section_id,
            Student.is_active.is_(True),
            Student.status == "ACTIVE",
        )
        .order_by(
            Student.first_name.asc(),
            Student.last_name.asc(),
            Student.id.asc(),
        )
        .all()
    )

    student_ids = [student.id for student in students]

    marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id == exam_id,
            Mark.subject_id == subject_id,
            Mark.student_id.in_(student_ids),
        )
        .all()
        if student_ids
        else []
    )

    marks_by_student = {
        mark.student_id: mark
        for mark in marks
    }

    def grade_for_percentage(percentage: float) -> str:
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

    register = []

    for student in students:
        mark = marks_by_student.get(student.id)

        obtained = (
            float(mark.marks_obtained)
            if mark is not None
            else None
        )

        percentage = (
            round(
                (obtained / float(config.max_marks)) * 100,
                2,
            )
            if obtained is not None and float(config.max_marks) > 0
            else None
        )

        register.append(
            {
                "student_id": student.id,
                "admission_number": student.admission_number,
                "student_name": (
                    f"{student.first_name} "
                    f"{student.last_name or ''}"
                ).strip(),
                "marks_id": mark.id if mark is not None else None,
                "marks_obtained": obtained,
                "max_marks": float(config.max_marks),
                "percentage": percentage,
                "grade": (
                    grade_for_percentage(percentage)
                    if percentage is not None
                    else None
                ),
            }
        )

    return {
        "section": {
            "id": section.id,
            "class_id": section.class_id,
            "name": section.name,
        },
        "exam": {
            "id": exam.id,
            "name": exam.name,
            "exam_type": getattr(exam, "exam_type", None),
            "academic_year": getattr(exam, "academic_year", None),
            "term": getattr(exam, "term", None),
            "start_date": (
                exam.start_date.isoformat()
                if getattr(exam, "start_date", None)
                else None
            ),
            "end_date": (
                exam.end_date.isoformat()
                if getattr(exam, "end_date", None)
                else None
            ),
            "status": exam_status,
            "is_editable": exam_status in EDITABLE_EXAM_STATUSES,
        },
        "subject": {
            "id": subject.id,
            "name": subject.name,
            "code": getattr(subject, "code", None),
            "max_marks": float(config.max_marks),
            "pass_marks": float(config.pass_marks),
            "is_optional": bool(
                getattr(config, "is_optional", False)
            ),
            "include_in_result": bool(
                getattr(config, "include_in_result", True)
            ),
        },
        "students": register,
    }
