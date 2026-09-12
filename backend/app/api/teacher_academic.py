from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models import (
    SchoolClass,
    SchoolSection,
    SectionSubjectTeacher,
    SectionTimetable,
    Subject,
    Teacher,
    TimetablePeriod,
    User,
)
from app.schemas.teacher_academic import (
    TeacherAcademicProfileResponse,
    TeacherAcademicSection,
    TeacherAcademicTimetableEntry,
)


router = APIRouter(
    prefix="/teachers",
    tags=["Teacher Academics"],
)


DAY_NAMES = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
}


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


def _authorize_teacher_access(
    teacher: Teacher,
    current_user: User,
) -> None:
    role = str(getattr(current_user, "role", "") or "").lower()

    # Admin/staff callers with teacher-view permission are handled by
    # permission-protected deployments separately. Teachers may only
    # inspect their own academic profile.
    if role == "teacher":
        if teacher.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own academic profile",
            )
        return

    if role in {"admin", "super_admin"}:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not allowed to view teacher academic data",
    )


def _teacher_name(teacher: Teacher) -> str:
    return (
        f"{teacher.first_name} {teacher.last_name}"
        .strip()
    )


@router.get(
    "/{teacher_id}/academic-profile",
    response_model=TeacherAcademicProfileResponse,
)
def get_teacher_academic_profile(
    teacher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_access(teacher, current_user)

    mappings = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher_id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .all()
    )

    class_teacher_sections = (
        db.query(SchoolSection)
        .filter(
            SchoolSection.class_teacher_id == teacher_id,
            SchoolSection.is_active.is_(True),
        )
        .all()
    )

    class_teacher_section_ids = {
        section.id for section in class_teacher_sections
    }

    section_ids = {mapping.section_id for mapping in mappings}
    section_ids.update(class_teacher_section_ids)

    sections_by_id = {}
    if section_ids:
        sections = (
            db.query(SchoolSection)
            .filter(
                SchoolSection.id.in_(section_ids),
                SchoolSection.is_active.is_(True),
            )
            .all()
        )
        sections_by_id = {section.id: section for section in sections}

    class_ids = {
        section.class_id
        for section in sections_by_id.values()
    }

    classes_by_id = {}
    if class_ids:
        school_classes = (
            db.query(SchoolClass)
            .filter(SchoolClass.id.in_(class_ids))
            .all()
        )
        classes_by_id = {
            school_class.id: school_class
            for school_class in school_classes
        }

    subject_ids = {mapping.subject_id for mapping in mappings}

    subjects_by_id = {}
    if subject_ids:
        subjects = (
            db.query(Subject)
            .filter(Subject.id.in_(subject_ids))
            .all()
        )
        subjects_by_id = {
            subject.id: subject
            for subject in subjects
        }

    section_responses: list[TeacherAcademicSection] = []

    seen_section_subjects: set[tuple[int, int]] = set()

    for mapping in sorted(
        mappings,
        key=lambda item: (
            sections_by_id.get(item.section_id).class_id
            if item.section_id in sections_by_id
            else 0,
            sections_by_id.get(item.section_id).name.lower()
            if item.section_id in sections_by_id
            else "",
            subjects_by_id.get(item.subject_id).name.lower()
            if item.subject_id in subjects_by_id
            else "",
        ),
    ):
        section = sections_by_id.get(mapping.section_id)
        subject = subjects_by_id.get(mapping.subject_id)

        if not section or not subject:
            continue

        pair = (section.id, subject.id)
        if pair in seen_section_subjects:
            continue

        seen_section_subjects.add(pair)

        school_class = classes_by_id.get(section.class_id)

        section_responses.append(
            TeacherAcademicSection(
                section_id=section.id,
                section_name=section.name,
                class_id=section.class_id,
                class_name=school_class.name if school_class else f"Class #{section.class_id}",
                subject_id=subject.id,
                subject_name=subject.name,
                subject_code=subject.code,
                is_class_teacher=section.id in class_teacher_section_ids,
            )
        )

    # Add sections where the teacher is class teacher but has no
    # subject-teacher mapping yet. This makes the academic profile
    # genuinely 360° and keeps class-teacher responsibility visible.
    existing_section_ids = {
        item.section_id for item in section_responses
    }

    for section in sorted(
        class_teacher_sections,
        key=lambda item: (item.name.lower(), item.id),
    ):
        if section.id in existing_section_ids:
            continue

        school_class = classes_by_id.get(section.class_id)

        # No subject is invented here because class-teacher responsibility
        # is not itself a subject assignment.
        # It is represented through the section summary count below.
        existing_section_ids.add(section.id)

    timetable_rows = (
        db.query(SectionTimetable)
        .filter(
            SectionTimetable.teacher_id == teacher_id,
            SectionTimetable.is_active.is_(True),
        )
        .all()
    )

    timetable_period_ids = {
        row.period_id for row in timetable_rows
    }
    timetable_subject_ids = {
        row.subject_id
        for row in timetable_rows
        if row.subject_id is not None
    }
    timetable_section_ids = {
        row.section_id for row in timetable_rows
    }

    timetable_sections_by_id = dict(sections_by_id)

    missing_section_ids = timetable_section_ids - set(
        timetable_sections_by_id.keys()
    )

    if missing_section_ids:
        extra_sections = (
            db.query(SchoolSection)
            .filter(
                SchoolSection.id.in_(missing_section_ids),
                SchoolSection.is_active.is_(True),
            )
            .all()
        )
        timetable_sections_by_id.update(
            {section.id: section for section in extra_sections}
        )

    timetable_periods_by_id = {}
    if timetable_period_ids:
        periods = (
            db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.id.in_(timetable_period_ids),
            )
            .all()
        )
        timetable_periods_by_id = {
            period.id: period for period in periods
        }

    timetable_subjects_by_id = dict(subjects_by_id)
    missing_subject_ids = timetable_subject_ids - set(
        timetable_subjects_by_id.keys()
    )

    if missing_subject_ids:
        extra_subjects = (
            db.query(Subject)
            .filter(Subject.id.in_(missing_subject_ids))
            .all()
        )
        timetable_subjects_by_id.update(
            {subject.id: subject for subject in extra_subjects}
        )

    timetable_class_ids = {
        section.class_id
        for section in timetable_sections_by_id.values()
    }

    timetable_classes_by_id = dict(classes_by_id)
    missing_class_ids = timetable_class_ids - set(
        timetable_classes_by_id.keys()
    )

    if missing_class_ids:
        extra_classes = (
            db.query(SchoolClass)
            .filter(SchoolClass.id.in_(missing_class_ids))
            .all()
        )
        timetable_classes_by_id.update(
            {school_class.id: school_class for school_class in extra_classes}
        )

    timetable_responses: list[TeacherAcademicTimetableEntry] = []

    for row in sorted(
        timetable_rows,
        key=lambda item: (
            item.day_of_week,
            timetable_periods_by_id.get(item.period_id).period_number
            if item.period_id in timetable_periods_by_id
            else 0,
            item.id,
        ),
    ):
        section = timetable_sections_by_id.get(row.section_id)
        period = timetable_periods_by_id.get(row.period_id)

        if not section or not period:
            continue

        school_class = timetable_classes_by_id.get(section.class_id)
        subject = (
            timetable_subjects_by_id.get(row.subject_id)
            if row.subject_id is not None
            else None
        )

        timetable_responses.append(
            TeacherAcademicTimetableEntry(
                timetable_id=row.id,
                section_id=section.id,
                section_name=section.name,
                class_id=section.class_id,
                class_name=(
                    school_class.name
                    if school_class
                    else f"Class #{section.class_id}"
                ),
                day_of_week=row.day_of_week,
                period_id=period.id,
                period_number=period.period_number,
                period_name=period.name,
                start_time=period.start_time,
                end_time=period.end_time,
                is_break=period.is_break,
                subject_id=subject.id if subject else None,
                subject_name=subject.name if subject else None,
                subject_code=subject.code if subject else None,
                teacher_id=row.teacher_id,
                room_number=row.room_number,
            )
        )

    return TeacherAcademicProfileResponse(
        teacher_id=teacher.id,
        employee_number=getattr(teacher, "employee_number", None),
        teacher_name=_teacher_name(teacher),
        sections=section_responses,
        timetable=timetable_responses,
        total_subject_assignments=len(mappings),
        total_sections=len(section_ids),
        class_teacher_sections=len(class_teacher_sections),
        weekly_timetable_periods=len(timetable_responses),
    )


@router.get(
    "/me/academic-profile",
    response_model=TeacherAcademicProfileResponse,
)
def get_my_teacher_academic_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = str(getattr(current_user, "role", "") or "").lower()

    if role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is available only to teacher accounts",
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found for this account",
        )

    # Reuse the same implementation through the explicit teacher id
    # while keeping /me convenient for the future Teacher App.
    return get_teacher_academic_profile(
        teacher_id=teacher.id,
        current_user=current_user,
        db=db,
    )
