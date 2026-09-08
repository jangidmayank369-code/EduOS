from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import Notice, User
from app.schemas.notice import NoticeCreate, NoticeUpdate, NoticeResponse
router = APIRouter(prefix="/notices", tags=["Notices"])


@router.post("/", response_model=NoticeResponse)
def create_notice(
    data: NoticeCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    notice = Notice(
        title=data.title,
        content=data.content,
        target_role=data.target_role,
        is_active=True,
    )

    db.add(notice)
    db.commit()
    db.refresh(notice)

    return notice
@router.get("/", response_model=list[NoticeResponse])
def get_notices(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    notices = (
        db.query(Notice)
        .filter(Notice.is_active == True)
        .order_by(Notice.created_at.desc())
        .all()
    )

    return notices
@router.get("/me", response_model=list[NoticeResponse])
def get_my_notices(
    current_user: User = Depends(
        require_role("parent", "teacher", "student")
    ),
    db: Session = Depends(get_db),
):
    notices = (
        db.query(Notice)
        .filter(
            Notice.is_active == True,
            Notice.target_role.in_(
                ["all", current_user.role]
            ),
        )
        .order_by(Notice.created_at.desc())
        .all()
    )

    return notices
@router.put("/{notice_id}", response_model=NoticeResponse)
def update_notice(
    notice_id: int,
    data: NoticeUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()

    if not notice:
        raise HTTPException(
            status_code=404,
            detail="Notice not found"
        )

    if data.title is not None:
        notice.title = data.title

    if data.content is not None:
        notice.content = data.content

    if data.target_role is not None:
        notice.target_role = data.target_role

    if data.is_active is not None:
        notice.is_active = data.is_active

    db.commit()
    db.refresh(notice)

    return notice