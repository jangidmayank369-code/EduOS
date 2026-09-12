from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models import Teacher, TeacherTask, User
from app.schemas.teacher_task import (
    ALLOWED_PRIORITIES,
    ALLOWED_STATUSES,
    ALLOWED_TASK_TYPES,
    TeacherTaskAdminUpdate,
    TeacherTaskCreate,
    TeacherTaskProgressUpdate,
    TeacherTaskResponse,
    TeacherTaskReview,
)


router = APIRouter(
    prefix="/teacher-tasks",
    tags=["Teacher Tasks"],
)


def _role(current_user: User) -> str:
    return str(
        getattr(current_user, "role", "") or ""
    ).lower()


def _require_admin(current_user: User) -> None:
    if _role(current_user) not in {"admin", "super_admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can manage teacher tasks.",
        )


def _get_task_or_404(
    db: Session,
    task_id: int,
) -> TeacherTask:
    task = (
        db.query(TeacherTask)
        .filter(TeacherTask.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher task not found.",
        )

    return task


def _get_teacher_for_user(
    db: Session,
    current_user: User,
) -> Teacher:
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
            detail="Teacher profile is not linked to this account.",
        )

    return teacher


@router.post(
    "/",
    response_model=TeacherTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_task(
    data: TeacherTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.id == data.teacher_id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active teacher not found.",
        )

    duplicate = (
        db.query(TeacherTask)
        .filter(
            TeacherTask.teacher_id == data.teacher_id,
            TeacherTask.title == data.title.strip(),
            TeacherTask.due_date == data.due_date,
            TeacherTask.status != "CANCELLED",
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active task with the same title and due date is already assigned to this teacher.",
        )

    task = TeacherTask(
        teacher_id=data.teacher_id,
        assigned_by_user_id=current_user.id,
        title=data.title.strip(),
        description=data.description,
        task_type=data.task_type.strip().upper(),
        priority=data.priority.strip().upper(),
        status="ASSIGNED",
        progress_percent=0,
        due_date=data.due_date,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


@router.get(
    "/",
    response_model=list[TeacherTaskResponse],
)
def list_teacher_tasks(
    teacher_id: int | None = Query(default=None, gt=0),
    task_status: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = _role(current_user)

    query = db.query(TeacherTask)

    if role in {"admin", "super_admin"}:
        if teacher_id is not None:
            query = query.filter(
                TeacherTask.teacher_id == teacher_id
            )
    elif role == "teacher":
        teacher = _get_teacher_for_user(db, current_user)
        query = query.filter(
            TeacherTask.teacher_id == teacher.id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to view teacher tasks.",
        )

    if task_status:
        normalized_status = task_status.strip().upper()

        if normalized_status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid task status. Allowed values: "
                    + ", ".join(sorted(ALLOWED_STATUSES))
                ),
            )

        query = query.filter(
            TeacherTask.status == normalized_status
        )

    return (
        query
        .order_by(
            TeacherTask.due_date.asc().nullslast(),
            TeacherTask.created_at.desc(),
        )
        .all()
    )


@router.get(
    "/{task_id}",
    response_model=TeacherTaskResponse,
)
def get_teacher_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_task_or_404(db, task_id)
    role = _role(current_user)

    if role == "teacher":
        teacher = _get_teacher_for_user(db, current_user)

        if task.teacher_id != teacher.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view tasks assigned to you.",
            )
    elif role not in {"admin", "super_admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to view teacher tasks.",
        )

    return task


@router.put(
    "/{task_id}",
    response_model=TeacherTaskResponse,
)
def update_teacher_task(
    task_id: int,
    data: TeacherTaskAdminUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    task = _get_task_or_404(db, task_id)
    update_data = data.model_dump(exclude_unset=True)

    if "teacher_id" in update_data:
        teacher = (
            db.query(Teacher)
            .filter(
                Teacher.id == update_data["teacher_id"],
                Teacher.is_active.is_(True),
            )
            .first()
        )

        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active teacher not found.",
            )

        task.teacher_id = update_data["teacher_id"]

    if "title" in update_data:
        task.title = update_data["title"].strip()

    if "description" in update_data:
        task.description = update_data["description"]

    if "task_type" in update_data:
        task.task_type = update_data["task_type"]

    if "priority" in update_data:
        task.priority = update_data["priority"]

    if "due_date" in update_data:
        task.due_date = update_data["due_date"]

    if "admin_remarks" in update_data:
        task.admin_remarks = update_data["admin_remarks"]

    if "status" in update_data:
        new_status = update_data["status"]

        if new_status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task status.",
            )

        task.status = new_status

        if new_status == "CANCELLED":
            task.progress_percent = 0

    db.commit()
    db.refresh(task)

    return task


@router.delete(
    "/{task_id}",
    response_model=TeacherTaskResponse,
)
def cancel_teacher_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    task = _get_task_or_404(db, task_id)

    if task.status == "CLOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A closed task cannot be cancelled.",
        )

    task.status = "CANCELLED"
    task.admin_remarks = (
        task.admin_remarks or ""
    ).strip()

    db.commit()
    db.refresh(task)

    return task


@router.patch(
    "/{task_id}/progress",
    response_model=TeacherTaskResponse,
)
def update_teacher_task_progress(
    task_id: int,
    data: TeacherTaskProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_task_or_404(db, task_id)

    if _role(current_user) != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned teacher can update task progress.",
        )

    teacher = _get_teacher_for_user(db, current_user)

    if task.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own assigned tasks.",
        )

    if task.status in {"CANCELLED", "APPROVED", "CLOSED"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This task is no longer editable by the teacher.",
        )

    task.progress_percent = data.progress_percent

    if data.status is not None:
        task.status = data.status
    elif data.progress_percent == 100:
        task.status = "SUBMITTED"
    elif data.progress_percent > 0:
        task.status = "IN_PROGRESS"
    else:
        task.status = "ASSIGNED"

    if task.status == "IN_PROGRESS" and task.started_at is None:
        task.started_at = datetime.utcnow()

    if task.status == "SUBMITTED":
        task.submitted_at = datetime.utcnow()
        task.progress_percent = 100

    if data.teacher_remarks is not None:
        task.teacher_remarks = data.teacher_remarks

    db.commit()
    db.refresh(task)

    return task


@router.patch(
    "/{task_id}/review",
    response_model=TeacherTaskResponse,
)
def review_teacher_task(
    task_id: int,
    data: TeacherTaskReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    task = _get_task_or_404(db, task_id)

    if task.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cancelled task cannot be reviewed.",
        )

    if data.status == "REWORK":
        task.status = "REWORK"
    elif data.status == "APPROVED":
        task.status = "APPROVED"
        task.progress_percent = 100
    elif data.status == "CLOSED":
        task.status = "CLOSED"
        task.progress_percent = 100
    elif data.status == "CANCELLED":
        task.status = "CANCELLED"

    task.reviewed_by_user_id = current_user.id
    task.reviewed_at = datetime.utcnow()

    if data.admin_remarks is not None:
        task.admin_remarks = data.admin_remarks

    db.commit()
    db.refresh(task)

    return task


@router.get(
    "/me/summary",
)
def get_my_teacher_task_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _role(current_user) != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is available only to teacher accounts.",
        )

    teacher = _get_teacher_for_user(db, current_user)

    tasks = (
        db.query(TeacherTask)
        .filter(
            TeacherTask.teacher_id == teacher.id
        )
        .all()
    )

    return {
        "teacher_id": teacher.id,
        "total": len(tasks),
        "assigned": sum(
            1 for task in tasks if task.status == "ASSIGNED"
        ),
        "in_progress": sum(
            1 for task in tasks if task.status == "IN_PROGRESS"
        ),
        "submitted": sum(
            1 for task in tasks if task.status == "SUBMITTED"
        ),
        "rework": sum(
            1 for task in tasks if task.status == "REWORK"
        ),
        "approved": sum(
            1 for task in tasks if task.status == "APPROVED"
        ),
        "closed": sum(
            1 for task in tasks if task.status == "CLOSED"
        ),
        "cancelled": sum(
            1 for task in tasks if task.status == "CANCELLED"
        ),
    }
