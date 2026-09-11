from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models.exam import Exam
from app.models.exam_schedule import ExamSchedule
from app.models.exam_subject import ExamSubject
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.schemas.exam_schedule import (
    ExamScheduleCreate,
    ExamScheduleResponse,
    ExamScheduleUpdate,
)


router = APIRouter(
    prefix="/exam-schedules",
    tags=["Exam Schedules"],
)


VALID_SHIFTS = {
    "MORNING",
    "AFTERNOON",
    "EVENING",
}

LOCKED_STATUSES = {
    "LOCKED",
    "PUBLISHED",
}


def validate_exam_editable(exam: Exam):
    if exam.status in LOCKED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Exam is {exam.status.lower()} and "
                "its timetable cannot be modified."
            ),
        )


def validate_exam_date(
    exam: Exam,
    exam_date: date,
):
    if exam.start_date and exam_date < exam.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Exam date cannot be before exam start date "
                f"({exam.start_date})."
            ),
        )

    if exam.end_date and exam_date > exam.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Exam date cannot be after exam end date "
                f"({exam.end_date})."
            ),
        )


def validate_exam_subject(
    db: Session,
    exam_id: int,
    class_id: int,
    subject_id: int,
):
    mapping = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == exam_id,
            ExamSubject.class_id == class_id,
            ExamSubject.subject_id == subject_id,
        )
        .first()
    )

    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This subject is not configured for the selected "
                "class in this exam. Add it under Exam Subjects first."
            ),
        )

    return mapping


def validate_time_range(
    start_time: time,
    end_time: time,
):
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time.",
        )


def times_overlap(
    start_a: time,
    end_a: time,
    start_b: time,
    end_b: time,
) -> bool:
    return start_a < end_b and end_a > start_b


def validate_schedule_conflicts(
    db: Session,
    *,
    exam_id: int,
    class_id: int,
    exam_date: date,
    start_time: time,
    end_time: time,
    room: str | None,
    exclude_id: int | None = None,
):
    query = (
        db.query(ExamSchedule)
        .filter(
            ExamSchedule.exam_id == exam_id,
            ExamSchedule.exam_date == exam_date,
            ExamSchedule.is_active.is_(True),
        )
    )

    if exclude_id is not None:
        query = query.filter(
            ExamSchedule.id != exclude_id
        )

    schedules = query.all()

    normalized_room = room.strip().lower() if room else None

    for existing in schedules:
        if not times_overlap(
            start_time,
            end_time,
            existing.start_time,
            existing.end_time,
        ):
            continue

        # Same class cannot have two overlapping exams.
        if existing.class_id == class_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Class timetable conflict: this class already "
                    f"has an exam from "
                    f"{existing.start_time.strftime('%H:%M')} "
                    f"to {existing.end_time.strftime('%H:%M')} on "
                    f"{existing.exam_date}."
                ),
            )

        # Same room cannot host two overlapping exams.
        if normalized_room and existing.room:
            existing_room = existing.room.strip().lower()

            if normalized_room == existing_room:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Room conflict: {existing.room} is already "
                        "assigned to another exam during this time."
                    ),
                )


@router.post(
    "/",
    response_model=ExamScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exam_schedule(
    payload: ExamScheduleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    exam = (
        db.query(Exam)
        .filter(Exam.id == payload.exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found.",
        )

    validate_exam_editable(exam)

    school_class = (
        db.query(SchoolClass)
        .filter(SchoolClass.id == payload.class_id)
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found.",
        )

    subject = (
        db.query(Subject)
        .filter(Subject.id == payload.subject_id)
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        )

    validate_exam_date(
        exam,
        payload.exam_date,
    )

    validate_time_range(
        payload.start_time,
        payload.end_time,
    )

    validate_exam_subject(
        db,
        payload.exam_id,
        payload.class_id,
        payload.subject_id,
    )

    validate_schedule_conflicts(
        db,
        exam_id=payload.exam_id,
        class_id=payload.class_id,
        exam_date=payload.exam_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        room=payload.room,
    )

    schedule = ExamSchedule(
        exam_id=payload.exam_id,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        exam_date=payload.exam_date,
        shift=payload.shift,
        start_time=payload.start_time,
        end_time=payload.end_time,
        room=payload.room.strip() if payload.room else None,
        instructions=payload.instructions,
        is_active=True,
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return schedule


@router.get(
    "/",
    response_model=list[ExamScheduleResponse],
)
def list_exam_schedules(
    exam_id: int | None = Query(default=None),
    class_id: int | None = Query(default=None),
    exam_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(ExamSchedule)

    if exam_id is not None:
        query = query.filter(
            ExamSchedule.exam_id == exam_id
        )

    if class_id is not None:
        query = query.filter(
            ExamSchedule.class_id == class_id
        )

    if exam_date is not None:
        query = query.filter(
            ExamSchedule.exam_date == exam_date
        )

    return (
        query
        .order_by(
            ExamSchedule.exam_date.asc(),
            ExamSchedule.start_time.asc(),
            ExamSchedule.class_id.asc(),
        )
        .all()
    )


@router.get(
    "/exam/{exam_id}",
    response_model=list[ExamScheduleResponse],
)
def get_exam_timetable(
    exam_id: int,
    class_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    exam = (
        db.query(Exam)
        .filter(Exam.id == exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found.",
        )

    query = db.query(ExamSchedule).filter(
        ExamSchedule.exam_id == exam_id
    )

    if class_id is not None:
        query = query.filter(
            ExamSchedule.class_id == class_id
        )

    return (
        query
        .order_by(
            ExamSchedule.exam_date.asc(),
            ExamSchedule.start_time.asc(),
            ExamSchedule.class_id.asc(),
        )
        .all()
    )


@router.get(
    "/{schedule_id}",
    response_model=ExamScheduleResponse,
)
def get_exam_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    schedule = (
        db.query(ExamSchedule)
        .filter(ExamSchedule.id == schedule_id)
        .first()
    )

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam schedule not found.",
        )

    return schedule


@router.put(
    "/{schedule_id}",
    response_model=ExamScheduleResponse,
)
def update_exam_schedule(
    schedule_id: int,
    payload: ExamScheduleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    schedule = (
        db.query(ExamSchedule)
        .filter(ExamSchedule.id == schedule_id)
        .first()
    )

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam schedule not found.",
        )

    exam = (
        db.query(Exam)
        .filter(Exam.id == schedule.exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found.",
        )

    validate_exam_editable(exam)

    new_class_id = (
        payload.class_id
        if payload.class_id is not None
        else schedule.class_id
    )

    new_subject_id = (
        payload.subject_id
        if payload.subject_id is not None
        else schedule.subject_id
    )

    new_exam_date = (
        payload.exam_date
        if payload.exam_date is not None
        else schedule.exam_date
    )

    new_start_time = (
        payload.start_time
        if payload.start_time is not None
        else schedule.start_time
    )

    new_end_time = (
        payload.end_time
        if payload.end_time is not None
        else schedule.end_time
    )

    new_room = (
        payload.room.strip()
        if payload.room
        else None
    )

    if payload.room is None:
        new_room = schedule.room

    school_class = (
        db.query(SchoolClass)
        .filter(SchoolClass.id == new_class_id)
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found.",
        )

    subject = (
        db.query(Subject)
        .filter(Subject.id == new_subject_id)
        .first()
    )

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        )

    validate_exam_date(
        exam,
        new_exam_date,
    )

    validate_time_range(
        new_start_time,
        new_end_time,
    )

    validate_exam_subject(
        db,
        schedule.exam_id,
        new_class_id,
        new_subject_id,
    )

    validate_schedule_conflicts(
        db,
        exam_id=schedule.exam_id,
        class_id=new_class_id,
        exam_date=new_exam_date,
        start_time=new_start_time,
        end_time=new_end_time,
        room=new_room,
        exclude_id=schedule.id,
    )

    schedule.class_id = new_class_id
    schedule.subject_id = new_subject_id
    schedule.exam_date = new_exam_date
    schedule.start_time = new_start_time
    schedule.end_time = new_end_time

    if payload.shift is not None:
        schedule.shift = payload.shift

    if payload.room is not None:
        schedule.room = (
            payload.room.strip()
            if payload.room.strip()
            else None
        )

    if payload.instructions is not None:
        schedule.instructions = payload.instructions

    if payload.is_active is not None:
        schedule.is_active = payload.is_active

    db.commit()
    db.refresh(schedule)

    return schedule


@router.delete(
    "/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_exam_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    schedule = (
        db.query(ExamSchedule)
        .filter(ExamSchedule.id == schedule_id)
        .first()
    )

    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam schedule not found.",
        )

    exam = (
        db.query(Exam)
        .filter(Exam.id == schedule.exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found.",
        )

    validate_exam_editable(exam)

    db.delete(schedule)
    db.commit()

    return None