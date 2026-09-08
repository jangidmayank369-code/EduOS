from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import get_current_user, require_role
from app.models import AcademicSession, User
from app.schemas.academic_session import (
    AcademicSessionCreate,
    AcademicSessionUpdate,
    AcademicSessionResponse,
)

router = APIRouter(
    prefix="/academic-sessions",
    tags=["Academic Sessions"],
)


@router.post(
    "/",
    response_model=AcademicSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_academic_session(
    data: AcademicSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing_session = (
        db.query(AcademicSession)
        .filter(AcademicSession.name == data.name)
        .first()
    )

    if existing_session:
        raise HTTPException(
            status_code=400,
            detail="Academic session with this name already exists",
        )

    if data.is_active:
        db.query(AcademicSession).filter(
            AcademicSession.is_active.is_(True)
        ).update(
            {"is_active": False},
            synchronize_session=False,
        )

    new_session = AcademicSession(
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=data.is_active,
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session


@router.get(
    "/",
    response_model=list[AcademicSessionResponse],
)
def get_academic_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return (
        db.query(AcademicSession)
        .order_by(AcademicSession.start_date.desc())
        .all()
    )


@router.get(
    "/{session_id}",
    response_model=AcademicSessionResponse,
)
def get_academic_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    session = (
        db.query(AcademicSession)
        .filter(AcademicSession.id == session_id)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Academic session not found",
        )

    return session


@router.put(
    "/{session_id}",
    response_model=AcademicSessionResponse,
)
def update_academic_session(
    session_id: int,
    data: AcademicSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    session = (
        db.query(AcademicSession)
        .filter(AcademicSession.id == session_id)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Academic session not found",
        )

    if data.name is not None and data.name != session.name:
        existing_session = (
            db.query(AcademicSession)
            .filter(
                AcademicSession.name == data.name,
                AcademicSession.id != session_id,
            )
            .first()
        )

        if existing_session:
            raise HTTPException(
                status_code=400,
                detail="Academic session with this name already exists",
            )

    new_start_date = (
        data.start_date
        if data.start_date is not None
        else session.start_date
    )

    new_end_date = (
        data.end_date
        if data.end_date is not None
        else session.end_date
    )

    if new_end_date <= new_start_date:
        raise HTTPException(
            status_code=400,
            detail="End date must be after start date",
        )

    if data.is_active is True:
        db.query(AcademicSession).filter(
            AcademicSession.id != session_id
        ).update(
            {"is_active": False},
            synchronize_session=False,
        )

    if data.name is not None:
        session.name = data.name

    if data.start_date is not None:
        session.start_date = data.start_date

    if data.end_date is not None:
        session.end_date = data.end_date

    if data.is_active is not None:
        session.is_active = data.is_active

    db.commit()
    db.refresh(session)

    return session


@router.patch(
    "/{session_id}/activate",
    response_model=AcademicSessionResponse,
)
def activate_academic_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    session = (
        db.query(AcademicSession)
        .filter(AcademicSession.id == session_id)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Academic session not found",
        )

    db.query(AcademicSession).filter(
        AcademicSession.id != session_id
    ).update(
        {"is_active": False},
        synchronize_session=False,
    )

    session.is_active = True

    db.commit()
    db.refresh(session)

    return session


@router.patch(
    "/{session_id}/deactivate",
    response_model=AcademicSessionResponse,
)
def deactivate_academic_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    session = (
        db.query(AcademicSession)
        .filter(AcademicSession.id == session_id)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Academic session not found",
        )

    session.is_active = False

    db.commit()
    db.refresh(session)

    return session


@router.get(
    "/current/active",
    response_model=AcademicSessionResponse,
)
def get_active_academic_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(AcademicSession)
        .filter(AcademicSession.is_active.is_(True))
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="No active academic session found",
        )

    return session