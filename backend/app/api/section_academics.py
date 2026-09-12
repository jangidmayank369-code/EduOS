from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models.school_section import SchoolSection
from app.models.section_subject_teacher import SectionSubjectTeacher
from app.models.section_timetable import SectionTimetable
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.timetable_period import TimetablePeriod
from app.schemas.section_subject_teacher import (
    SectionSubjectTeacherCreate,
    SectionSubjectTeacherResponse,
    SectionSubjectTeacherUpdate,
)
from app.schemas.section_timetable import (
    SectionTimetableCreate,
    SectionTimetableResponse,
    SectionTimetableUpdate,
)
from app.schemas.timetable_period import (
    TimetablePeriodCreate,
    TimetablePeriodResponse,
    TimetablePeriodUpdate,
)


router = APIRouter(tags=["Section Academics"])


# ============================================================
# COMMON HELPERS
# ============================================================


def get_active_section(
    db: Session,
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
            detail="Active section not found.",
        )

    return section


def get_active_period(
    db: Session,
    period_id: int,
) -> TimetablePeriod:
    period = (
        db.query(TimetablePeriod)
        .filter(
            TimetablePeriod.id == period_id,
            TimetablePeriod.is_active.is_(True),
        )
        .first()
    )

    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active timetable period not found.",
        )

    if period.end_time <= period.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid timetable period time range.",
        )

    return period


def get_active_subject(
    db: Session,
    subject_id: int,
) -> Subject:
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
            detail="Active subject not found.",
        )

    return subject


def get_active_teacher(
    db: Session,
    teacher_id: int,
) -> Teacher:
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.id == teacher_id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active teacher not found.",
        )

    return teacher


def get_section_subject_mapping(
    db: Session,
    section_id: int,
    subject_id: int,
) -> SectionSubjectTeacher | None:
    return (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.section_id == section_id,
            SectionSubjectTeacher.subject_id == subject_id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .first()
    )


def validate_section_subject(
    db: Session,
    section_id: int,
    subject_id: int,
) -> Subject:
    subject = get_active_subject(db, subject_id)

    mapping = get_section_subject_mapping(
        db,
        section_id,
        subject_id,
    )

    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This subject has no teacher assigned in the selected "
                "section. Assign a section subject teacher first."
            ),
        )

    return subject


# ============================================================
# SECTION SUBJECT TEACHERS
# ============================================================


@router.post(
    "/sections/{section_id}/subject-teachers",
    response_model=SectionSubjectTeacherResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_section_subject_teacher(
    section_id: int,
    payload: SectionSubjectTeacherCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    section = get_active_section(db, section_id)

    get_active_subject(db, payload.subject_id)
    get_active_teacher(db, payload.teacher_id)

    existing = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.section_id == section.id,
            SectionSubjectTeacher.subject_id == payload.subject_id,
        )
        .first()
    )

    if existing:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This subject already has a teacher assigned "
                    "in the selected section."
                ),
            )

        existing.teacher_id = payload.teacher_id
        existing.is_active = True

        db.commit()
        db.refresh(existing)

        return existing

    mapping = SectionSubjectTeacher(
        section_id=section.id,
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        is_active=True,
    )

    db.add(mapping)
    db.commit()
    db.refresh(mapping)

    return mapping


@router.get(
    "/sections/{section_id}/subject-teachers",
    response_model=list[SectionSubjectTeacherResponse],
)
def list_section_subject_teachers(
    section_id: int,
    db: Session = Depends(get_db),
):
    section = get_active_section(db, section_id)

    return (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.section_id == section.id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .order_by(
            SectionSubjectTeacher.subject_id.asc(),
            SectionSubjectTeacher.id.asc(),
        )
        .all()
    )


@router.get(
    "/sections/{section_id}/subject-teachers/{mapping_id}",
    response_model=SectionSubjectTeacherResponse,
)
def get_section_subject_teacher(
    section_id: int,
    mapping_id: int,
    db: Session = Depends(get_db),
):
    section = get_active_section(db, section_id)

    mapping = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.id == mapping_id,
            SectionSubjectTeacher.section_id == section.id,
        )
        .first()
    )

    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section subject-teacher mapping not found.",
        )

    return mapping


@router.put(
    "/sections/{section_id}/subject-teachers/{mapping_id}",
    response_model=SectionSubjectTeacherResponse,
)
def update_section_subject_teacher(
    section_id: int,
    mapping_id: int,
    payload: SectionSubjectTeacherUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    section = get_active_section(db, section_id)

    mapping = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.id == mapping_id,
            SectionSubjectTeacher.section_id == section.id,
        )
        .first()
    )

    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section subject-teacher mapping not found.",
        )

    new_teacher_id = payload.teacher_id

    get_active_teacher(db, new_teacher_id)

    duplicate = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.section_id == section.id,
            SectionSubjectTeacher.subject_id == mapping.subject_id,
            SectionSubjectTeacher.id != mapping.id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This subject already has another active teacher "
                "in the selected section."
            ),
        )

    mapping.teacher_id = new_teacher_id

    db.commit()
    db.refresh(mapping)

    return mapping


@router.delete(
    "/sections/{section_id}/subject-teachers/{mapping_id}",
    response_model=SectionSubjectTeacherResponse,
)
def delete_section_subject_teacher(
    section_id: int,
    mapping_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    section = get_active_section(db, section_id)

    mapping = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.id == mapping_id,
            SectionSubjectTeacher.section_id == section.id,
        )
        .first()
    )

    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section subject-teacher mapping not found.",
        )

    mapping.is_active = False

    db.commit()
    db.refresh(mapping)

    return mapping


# ============================================================
# TIMETABLE PERIOD MASTER
# ============================================================


@router.post(
    "/timetable/periods",
    response_model=TimetablePeriodResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_timetable_period(
    payload: TimetablePeriodCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing = (
        db.query(TimetablePeriod)
        .filter(
            TimetablePeriod.period_number == payload.period_number,
        )
        .first()
    )

    if existing:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Period number already exists.",
            )

        existing.name = payload.name.strip()
        existing.start_time = payload.start_time
        existing.end_time = payload.end_time
        existing.is_break = payload.is_break
        existing.is_active = True

        db.commit()
        db.refresh(existing)

        return existing

    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time.",
        )

    period = TimetablePeriod(
        period_number=payload.period_number,
        name=payload.name.strip(),
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_break=payload.is_break,
        is_active=True,
    )

    db.add(period)
    db.commit()
    db.refresh(period)

    return period


@router.get(
    "/timetable/periods",
    response_model=list[TimetablePeriodResponse],
)
def list_timetable_periods(
    db: Session = Depends(get_db),
):
    return (
        db.query(TimetablePeriod)
        .filter(
            TimetablePeriod.is_active.is_(True),
        )
        .order_by(
            TimetablePeriod.period_number.asc(),
        )
        .all()
    )


@router.get(
    "/timetable/periods/{period_id}",
    response_model=TimetablePeriodResponse,
)
def get_timetable_period(
    period_id: int,
    db: Session = Depends(get_db),
):
    period = (
        db.query(TimetablePeriod)
        .filter(
            TimetablePeriod.id == period_id,
        )
        .first()
    )

    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable period not found.",
        )

    return period


@router.put(
    "/timetable/periods/{period_id}",
    response_model=TimetablePeriodResponse,
)
def update_timetable_period(
    period_id: int,
    payload: TimetablePeriodUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    period = (
        db.query(TimetablePeriod)
        .filter(
            TimetablePeriod.id == period_id,
        )
        .first()
    )

    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable period not found.",
        )

    data = payload.model_dump(exclude_unset=True)

    new_period_number = data.get(
        "period_number",
        period.period_number,
    )

    if new_period_number != period.period_number:
        duplicate = (
            db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.period_number == new_period_number,
                TimetablePeriod.id != period.id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Period number already exists.",
            )

    new_start_time = data.get(
        "start_time",
        period.start_time,
    )

    new_end_time = data.get(
        "end_time",
        period.end_time,
    )

    if new_end_time <= new_start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time.",
        )

    for key, value in data.items():
        if key == "name" and isinstance(value, str):
            value = value.strip()

        setattr(period, key, value)

    db.commit()
    db.refresh(period)

    return period


@router.delete(
    "/timetable/periods/{period_id}",
    response_model=TimetablePeriodResponse,
)
def delete_timetable_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    period = (
        db.query(TimetablePeriod)
        .filter(
            TimetablePeriod.id == period_id,
        )
        .first()
    )

    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable period not found.",
        )

    period.is_active = False

    db.commit()
    db.refresh(period)

    return period


# ============================================================
# SECTION TIMETABLE
# ============================================================


@router.post(
    "/sections/{section_id}/timetable",
    response_model=SectionTimetableResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_section_timetable(
    section_id: int,
    payload: SectionTimetableCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    section = get_active_section(db, section_id)

    period = get_active_period(
        db,
        payload.period_id,
    )

    if payload.day_of_week < 1 or payload.day_of_week > 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_of_week must be between 1 and 7.",
        )

    # --------------------------------------------------------
    # Break
    # --------------------------------------------------------

    if period.is_break:
        if payload.subject_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Break periods cannot have a subject.",
            )

        if payload.teacher_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Break periods cannot have a teacher.",
            )

    # --------------------------------------------------------
    # Academic period
    # --------------------------------------------------------

    else:
        if payload.subject_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A non-break period requires a subject.",
            )

        validate_section_subject(
            db,
            section.id,
            payload.subject_id,
        )

        if payload.teacher_id is not None:
            get_active_teacher(
                db,
                payload.teacher_id,
            )

    duplicate = (
        db.query(SectionTimetable)
        .filter(
            SectionTimetable.section_id == section.id,
            SectionTimetable.day_of_week == payload.day_of_week,
            SectionTimetable.period_id == period.id,
            SectionTimetable.is_active.is_(True),
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This section already has a timetable entry "
                "for the selected day and period."
            ),
        )

    room_number = (
        payload.room_number.strip()
        if payload.room_number
        else None
    )

    entry = SectionTimetable(
        section_id=section.id,
        period_id=period.id,
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        day_of_week=payload.day_of_week,
        room_number=room_number,
        is_active=True,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry


@router.get(
    "/sections/{section_id}/timetable",
    response_model=list[SectionTimetableResponse],
)
def list_section_timetable(
    section_id: int,
    db: Session = Depends(get_db),
):
    section = get_active_section(db, section_id)

    return (
        db.query(SectionTimetable)
        .filter(
            SectionTimetable.section_id == section.id,
            SectionTimetable.is_active.is_(True),
        )
        .join(
            TimetablePeriod,
            TimetablePeriod.id == SectionTimetable.period_id,
        )
        .filter(
            TimetablePeriod.is_active.is_(True),
        )
        .order_by(
            SectionTimetable.day_of_week.asc(),
            TimetablePeriod.period_number.asc(),
        )
        .all()
    )


@router.get(
    "/sections/{section_id}/timetable/{entry_id}",
    response_model=SectionTimetableResponse,
)
def get_section_timetable_entry(
    section_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
):
    section = get_active_section(db, section_id)

    entry = (
        db.query(SectionTimetable)
        .filter(
            SectionTimetable.id == entry_id,
            SectionTimetable.section_id == section.id,
        )
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section timetable entry not found.",
        )

    return entry


@router.put(
    "/sections/{section_id}/timetable/{entry_id}",
    response_model=SectionTimetableResponse,
)
def update_section_timetable(
    section_id: int,
    entry_id: int,
    payload: SectionTimetableUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    section = get_active_section(db, section_id)

    entry = (
        db.query(SectionTimetable)
        .filter(
            SectionTimetable.id == entry_id,
            SectionTimetable.section_id == section.id,
        )
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section timetable entry not found.",
        )

    data = payload.model_dump(
        exclude_unset=True,
    )

    new_period_id = data.get(
        "period_id",
        entry.period_id,
    )

    new_day_of_week = data.get(
        "day_of_week",
        entry.day_of_week,
    )

    new_subject_id = data.get(
        "subject_id",
        entry.subject_id,
    )

    new_teacher_id = data.get(
        "teacher_id",
        entry.teacher_id,
    )

    new_is_active = data.get(
        "is_active",
        entry.is_active,
    )

    period = get_active_period(
        db,
        new_period_id,
    )

    if new_day_of_week < 1 or new_day_of_week > 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_of_week must be between 1 and 7.",
        )

    # --------------------------------------------------------
    # Break
    # --------------------------------------------------------

    if period.is_break:
        if new_subject_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Break periods cannot have a subject.",
            )

        new_teacher_id = None

    # --------------------------------------------------------
    # Academic period
    # --------------------------------------------------------

    else:
        if new_subject_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A non-break period requires a subject.",
            )

        validate_section_subject(
            db,
            section.id,
            new_subject_id,
        )

        if new_teacher_id is not None:
            get_active_teacher(
                db,
                new_teacher_id,
            )

    duplicate = (
        db.query(SectionTimetable)
        .filter(
            SectionTimetable.section_id == section.id,
            SectionTimetable.day_of_week == new_day_of_week,
            SectionTimetable.period_id == new_period_id,
            SectionTimetable.id != entry.id,
            SectionTimetable.is_active.is_(True),
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This section already has another timetable entry "
                "for the selected day and period."
            ),
        )

    entry.period_id = new_period_id
    entry.day_of_week = new_day_of_week
    entry.subject_id = new_subject_id
    entry.teacher_id = new_teacher_id
    entry.is_active = new_is_active

    if "room_number" in data:
        entry.room_number = (
            data["room_number"].strip()
            if data["room_number"]
            else None
        )

    db.commit()
    db.refresh(entry)

    return entry


@router.delete(
    "/sections/{section_id}/timetable/{entry_id}",
    response_model=SectionTimetableResponse,
)
def delete_section_timetable(
    section_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    section = get_active_section(db, section_id)

    entry = (
        db.query(SectionTimetable)
        .filter(
            SectionTimetable.id == entry_id,
            SectionTimetable.section_id == section.id,
        )
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section timetable entry not found.",
        )

    entry.is_active = False

    db.commit()
    db.refresh(entry)

    return entry