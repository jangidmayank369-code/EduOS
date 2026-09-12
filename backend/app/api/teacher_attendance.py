from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.core.rbac import require_permission
from app.models import Teacher, TeacherAttendance, TeacherLeave, User
from app.schemas.teacher_attendance import (
    TeacherAttendanceCreate,
    TeacherAttendanceResponse,
    TeacherAttendanceUpdate,
    TeacherLeaveCreate,
    TeacherLeaveResponse,
    TeacherLeaveUpdate,
)


router = APIRouter(
    prefix="/teachers",
    tags=["Teacher Attendance & Leave"],
)


ALLOWED_ATTENDANCE_STATUSES = {
    "PRESENT",
    "ABSENT",
    "HALF_DAY",
    "ON_LEAVE",
    "HOLIDAY",
    "LATE",
}

ALLOWED_LEAVE_TYPES = {
    "CASUAL",
    "SICK",
    "EARNED",
    "UNPAID",
    "OTHER",
}

ALLOWED_LEAVE_STATUSES = {
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
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


def _authorize_teacher_self_or_admin(
    teacher: Teacher,
    current_user: User,
) -> None:
    role = str(getattr(current_user, "role", "") or "").lower()

    if role in {"admin", "super_admin"}:
        return

    if role == "teacher" and teacher.user_id == current_user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not allowed to access this teacher data",
    )


def _validate_leave_type(value: str) -> str:
    value = value.strip().upper()

    if value not in ALLOWED_LEAVE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid leave type. Allowed values: "
                + ", ".join(sorted(ALLOWED_LEAVE_TYPES))
            ),
        )

    return value


def _validate_leave_status(value: str) -> str:
    value = value.strip().upper()

    if value not in ALLOWED_LEAVE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid leave status. Allowed values: "
                + ", ".join(sorted(ALLOWED_LEAVE_STATUSES))
            ),
        )

    return value


def _validate_attendance_status(value: str) -> str:
    value = value.strip().upper()

    if value not in ALLOWED_ATTENDANCE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid attendance status. Allowed values: "
                + ", ".join(sorted(ALLOWED_ATTENDANCE_STATUSES))
            ),
        )

    return value


def _get_leave_for_teacher_or_404(
    db: Session,
    teacher_id: int,
    leave_id: int,
) -> TeacherLeave:
    leave = (
        db.query(TeacherLeave)
        .filter(
            TeacherLeave.id == leave_id,
            TeacherLeave.teacher_id == teacher_id,
        )
        .first()
    )

    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher leave record not found",
        )

    return leave


def _get_attendance_for_teacher_or_404(
    db: Session,
    teacher_id: int,
    attendance_id: int,
) -> TeacherAttendance:
    record = (
        db.query(TeacherAttendance)
        .filter(
            TeacherAttendance.id == attendance_id,
            TeacherAttendance.teacher_id == teacher_id,
        )
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher attendance record not found",
        )

    return record


def _validate_leave_dates(
    start_date: date,
    end_date: date,
) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date.",
        )


def _check_leave_overlap(
    db: Session,
    teacher_id: int,
    start_date: date,
    end_date: date,
    exclude_leave_id: int | None = None,
) -> None:
    query = (
        db.query(TeacherLeave)
        .filter(
            TeacherLeave.teacher_id == teacher_id,
            TeacherLeave.status != "CANCELLED",
            TeacherLeave.start_date <= end_date,
            TeacherLeave.end_date >= start_date,
        )
    )

    if exclude_leave_id is not None:
        query = query.filter(TeacherLeave.id != exclude_leave_id)

    existing = query.first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Teacher already has an overlapping leave request.",
        )


def _validate_leave_reference(
    db: Session,
    teacher_id: int,
    leave_id: int | None,
    attendance_date: date,
) -> TeacherLeave | None:
    if leave_id is None:
        return None

    leave = _get_leave_for_teacher_or_404(
        db,
        teacher_id,
        leave_id,
    )

    if leave.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance can reference only an approved leave.",
        )

    if not (
        leave.start_date <= attendance_date <= leave.end_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance date is outside the selected leave period.",
        )

    return leave


@router.post(
    "/{teacher_id}/leaves",
    response_model=TeacherLeaveResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_leave(
    teacher_id: int,
    data: TeacherLeaveCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    leave_type = _validate_leave_type(data.leave_type)
    _validate_leave_dates(data.start_date, data.end_date)

    _check_leave_overlap(
        db,
        teacher_id,
        data.start_date,
        data.end_date,
    )

    is_admin = str(getattr(current_user, "role", "") or "").lower() in {
        "admin",
        "super_admin",
    }

    leave = TeacherLeave(
        teacher_id=teacher_id,
        leave_type=leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        remarks=data.remarks,
        status="APPROVED" if is_admin else "PENDING",
        reviewed_by_user_id=current_user.id if is_admin else None,
        reviewed_at=__import__("datetime").datetime.utcnow() if is_admin else None,
    )

    db.add(leave)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create teacher leave request",
        )

    db.refresh(leave)

    return leave


@router.get(
    "/{teacher_id}/leaves",
    response_model=list[TeacherLeaveResponse],
)
def list_teacher_leaves(
    teacher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    return (
        db.query(TeacherLeave)
        .filter(TeacherLeave.teacher_id == teacher_id)
        .order_by(
            TeacherLeave.start_date.desc(),
            TeacherLeave.id.desc(),
        )
        .all()
    )


@router.get(
    "/{teacher_id}/leaves/{leave_id}",
    response_model=TeacherLeaveResponse,
)
def get_teacher_leave(
    teacher_id: int,
    leave_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    return _get_leave_for_teacher_or_404(
        db,
        teacher_id,
        leave_id,
    )


@router.put(
    "/{teacher_id}/leaves/{leave_id}",
    response_model=TeacherLeaveResponse,
)
def update_teacher_leave(
    teacher_id: int,
    leave_id: int,
    data: TeacherLeaveUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    leave = _get_leave_for_teacher_or_404(
        db,
        teacher_id,
        leave_id,
    )

    is_admin = str(getattr(current_user, "role", "") or "").lower() in {
        "admin",
        "super_admin",
    }

    update_data = data.model_dump(exclude_unset=True)

    if "leave_type" in update_data and update_data["leave_type"] is not None:
        update_data["leave_type"] = _validate_leave_type(
            update_data["leave_type"]
        )

    if "status" in update_data and update_data["status"] is not None:
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can change leave status.",
            )

        update_data["status"] = _validate_leave_status(
            update_data["status"]
        )

    start_date = update_data.get("start_date", leave.start_date)
    end_date = update_data.get("end_date", leave.end_date)

    _validate_leave_dates(start_date, end_date)

    if (
        "start_date" in update_data
        or "end_date" in update_data
    ):
        _check_leave_overlap(
            db,
            teacher_id,
            start_date,
            end_date,
            exclude_leave_id=leave.id,
        )

    for field, value in update_data.items():
        setattr(leave, field, value)

    if is_admin and "status" in update_data:
        leave.reviewed_by_user_id = current_user.id
        leave.reviewed_at = __import__("datetime").datetime.utcnow()

    db.add(leave)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to update teacher leave request",
        )

    db.refresh(leave)

    return leave


@router.delete(
    "/{teacher_id}/leaves/{leave_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_teacher_leave(
    teacher_id: int,
    leave_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    leave = _get_leave_for_teacher_or_404(
        db,
        teacher_id,
        leave_id,
    )

    if leave.status == "APPROVED" and str(
        getattr(current_user, "role", "") or ""
    ).lower() not in {"admin", "super_admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approved leave can only be removed by an administrator.",
        )

    leave.status = "CANCELLED"
    leave.reviewed_by_user_id = current_user.id
    leave.reviewed_at = __import__("datetime").datetime.utcnow()

    db.add(leave)
    db.commit()

    return None


@router.post(
    "/{teacher_id}/attendance",
    response_model=TeacherAttendanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_attendance(
    teacher_id: int,
    data: TeacherAttendanceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    attendance_status = _validate_attendance_status(data.status)

    existing = (
        db.query(TeacherAttendance)
        .filter(
            TeacherAttendance.teacher_id == teacher_id,
            TeacherAttendance.attendance_date == data.attendance_date,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance already exists for this teacher and date.",
        )

    leave = _validate_leave_reference(
        db,
        teacher_id,
        data.leave_id,
        data.attendance_date,
    )

    if attendance_status == "ON_LEAVE" and leave is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ON_LEAVE attendance requires an approved leave reference.",
        )

    if leave is not None and attendance_status != "ON_LEAVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance linked to leave must use ON_LEAVE status.",
        )

    record = TeacherAttendance(
        teacher_id=teacher_id,
        attendance_date=data.attendance_date,
        status=attendance_status,
        check_in=data.check_in,
        check_out=data.check_out,
        leave_id=data.leave_id,
        remarks=data.remarks,
    )

    db.add(record)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create teacher attendance record",
        )

    db.refresh(record)

    return record


@router.get(
    "/{teacher_id}/attendance",
    response_model=list[TeacherAttendanceResponse],
)
def list_teacher_attendance(
    teacher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    return (
        db.query(TeacherAttendance)
        .filter(TeacherAttendance.teacher_id == teacher_id)
        .order_by(
            TeacherAttendance.attendance_date.desc(),
            TeacherAttendance.id.desc(),
        )
        .all()
    )


@router.get(
    "/{teacher_id}/attendance/{attendance_id}",
    response_model=TeacherAttendanceResponse,
)
def get_teacher_attendance(
    teacher_id: int,
    attendance_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    return _get_attendance_for_teacher_or_404(
        db,
        teacher_id,
        attendance_id,
    )


@router.put(
    "/{teacher_id}/attendance/{attendance_id}",
    response_model=TeacherAttendanceResponse,
)
def update_teacher_attendance(
    teacher_id: int,
    attendance_id: int,
    data: TeacherAttendanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_or_404(db, teacher_id)
    _authorize_teacher_self_or_admin(teacher, current_user)

    record = _get_attendance_for_teacher_or_404(
        db,
        teacher_id,
        attendance_id,
    )

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = _validate_attendance_status(
            update_data["status"]
        )

    attendance_date = update_data.get(
        "attendance_date",
        record.attendance_date,
    )

    new_check_in = update_data.get(
        "check_in",
        record.check_in,
    )
    new_check_out = update_data.get(
        "check_out",
        record.check_out,
    )

    if new_check_in and new_check_out and new_check_out < new_check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-out time cannot be before check-in time.",
        )

    if "attendance_date" in update_data:
        duplicate = (
            db.query(TeacherAttendance)
            .filter(
                TeacherAttendance.teacher_id == teacher_id,
                TeacherAttendance.attendance_date == attendance_date,
                TeacherAttendance.id != record.id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Attendance already exists for this teacher and date.",
            )

    leave_id = update_data.get(
        "leave_id",
        record.leave_id,
    )

    attendance_status = update_data.get(
        "status",
        record.status,
    )

    leave = _validate_leave_reference(
        db,
        teacher_id,
        leave_id,
        attendance_date,
    )

    if attendance_status == "ON_LEAVE" and leave is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ON_LEAVE attendance requires an approved leave reference.",
        )

    if leave is not None and attendance_status != "ON_LEAVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance linked to leave must use ON_LEAVE status.",
        )

    for field, value in update_data.items():
        setattr(record, field, value)

    db.add(record)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to update teacher attendance record",
        )

    db.refresh(record)

    return record


@router.delete(
    "/{teacher_id}/attendance/{attendance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_teacher_attendance(
    teacher_id: int,
    attendance_id: int,
    current_user: User = Depends(
        require_permission("teachers.update")
    ),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)

    record = _get_attendance_for_teacher_or_404(
        db,
        teacher_id,
        attendance_id,
    )

    db.delete(record)
    db.commit()

    return None


@router.get(
    "/me/attendance",
    response_model=list[TeacherAttendanceResponse],
)
def get_my_teacher_attendance(
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

    return (
        db.query(TeacherAttendance)
        .filter(TeacherAttendance.teacher_id == teacher.id)
        .order_by(
            TeacherAttendance.attendance_date.desc(),
            TeacherAttendance.id.desc(),
        )
        .all()
    )


@router.get(
    "/me/leaves",
    response_model=list[TeacherLeaveResponse],
)
def get_my_teacher_leaves(
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

    return (
        db.query(TeacherLeave)
        .filter(TeacherLeave.teacher_id == teacher.id)
        .order_by(
            TeacherLeave.start_date.desc(),
            TeacherLeave.id.desc(),
        )
        .all()
    )
