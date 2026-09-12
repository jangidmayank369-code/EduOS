from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models import Teacher, TeacherDocument, User
from app.schemas.teacher_document import (
    TeacherDocumentCreate,
    TeacherDocumentResponse,
    TeacherDocumentUpdate,
)


router = APIRouter(
    prefix="/teachers",
    tags=["Teacher Documents"],
)


def _get_teacher_or_404(db: Session, teacher_id: int) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )
    return teacher


def _get_document_or_404(
    db: Session,
    teacher_id: int,
    document_id: int,
) -> TeacherDocument:
    document = (
        db.query(TeacherDocument)
        .filter(
            TeacherDocument.id == document_id,
            TeacherDocument.teacher_id == teacher_id,
        )
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher document not found",
        )
    return document


def _validate_type(document_type: str) -> str:
    allowed = {
        "AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE", "VOTER_ID",
        "QUALIFICATION", "EXPERIENCE", "JOINING_LETTER", "RELIEVING_LETTER",
        "ADDRESS_PROOF", "BANK_PROOF", "CONTRACT", "OTHER",
    }
    if document_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported document_type: {document_type}",
        )
    return document_type


@router.post(
    "/{teacher_id}/documents",
    response_model=TeacherDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher_document(
    teacher_id: int,
    data: TeacherDocumentCreate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)
    document_type = _validate_type(data.document_type)

    document = TeacherDocument(
        teacher_id=teacher_id,
        document_type=document_type,
        document_name=data.document_name,
        document_number=data.document_number,
        issue_date=data.issue_date,
        expiry_date=data.expiry_date,
        file_url=data.file_url,
        file_name=data.file_name,
        mime_type=data.mime_type,
        is_verified=data.is_verified,
        verified_by_user_id=current_user.id if data.is_verified else None,
        verified_at=datetime.utcnow() if data.is_verified else None,
        is_active=True,
        remarks=data.remarks,
    )

    db.add(document)

    try:
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create teacher document",
        )

    return document


@router.get(
    "/{teacher_id}/documents",
    response_model=list[TeacherDocumentResponse],
)
def list_teacher_documents(
    teacher_id: int,
    include_inactive: bool = False,
    document_type: str | None = None,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    _get_teacher_or_404(db, teacher_id)

    query = db.query(TeacherDocument).filter(
        TeacherDocument.teacher_id == teacher_id,
    )

    if not include_inactive:
        query = query.filter(TeacherDocument.is_active.is_(True))

    if document_type:
        query = query.filter(
            TeacherDocument.document_type == document_type.strip().upper(),
        )

    return query.order_by(
        TeacherDocument.created_at.desc(),
        TeacherDocument.id.desc(),
    ).all()


@router.get(
    "/{teacher_id}/documents/{document_id}",
    response_model=TeacherDocumentResponse,
)
def get_teacher_document(
    teacher_id: int,
    document_id: int,
    current_user: User = Depends(require_permission("teachers.view")),
    db: Session = Depends(get_db),
):
    return _get_document_or_404(db, teacher_id, document_id)


@router.put(
    "/{teacher_id}/documents/{document_id}",
    response_model=TeacherDocumentResponse,
)
def update_teacher_document(
    teacher_id: int,
    document_id: int,
    data: TeacherDocumentUpdate,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    document = _get_document_or_404(db, teacher_id, document_id)
    update_data = data.model_dump(exclude_unset=True)

    if "document_type" in update_data and update_data["document_type"] is not None:
        update_data["document_type"] = _validate_type(update_data["document_type"])

    issue_date = update_data.get("issue_date", document.issue_date)
    expiry_date = update_data.get("expiry_date", document.expiry_date)

    if issue_date and expiry_date and expiry_date < issue_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expiry_date cannot be before issue_date",
        )

    for field, value in update_data.items():
        setattr(document, field, value)

    if "is_verified" in update_data:
        if document.is_verified:
            document.verified_by_user_id = current_user.id
            document.verified_at = datetime.utcnow()
        else:
            document.verified_by_user_id = None
            document.verified_at = None

    try:
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to update teacher document",
        )

    return document


@router.delete(
    "/{teacher_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_teacher_document(
    teacher_id: int,
    document_id: int,
    current_user: User = Depends(require_permission("teachers.update")),
    db: Session = Depends(get_db),
):
    document = _get_document_or_404(db, teacher_id, document_id)
    document.is_active = False

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to deactivate teacher document",
        )

    return None
