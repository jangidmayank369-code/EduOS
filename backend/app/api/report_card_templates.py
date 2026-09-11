from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models.report_card_template import ReportCardTemplate
from app.models.user import User
from app.schemas.report_card_template import (
    ReportCardTemplateCreate,
    ReportCardTemplateDefaultResponse,
    ReportCardTemplateDuplicateRequest,
    ReportCardTemplateResponse,
    ReportCardTemplateUpdate,
)


router = APIRouter(
    prefix="/report-card-templates",
    tags=["Report Card Templates"],
)


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def _template_to_response(
    template: ReportCardTemplate,
) -> ReportCardTemplateResponse:
    return ReportCardTemplateResponse.model_validate(template)


def _unset_defaults(
    db: Session,
    *,
    class_id: int | None,
    academic_session_id: int | None,
    exam_id: int | None,
    except_id: int | None = None,
) -> None:
    """
    Make sure only one template is default for the same scope.
    """

    query = db.query(ReportCardTemplate).filter(
        ReportCardTemplate.is_default.is_(True)
    )

    if class_id is None:
        query = query.filter(ReportCardTemplate.class_id.is_(None))
    else:
        query = query.filter(
            ReportCardTemplate.class_id == class_id
        )

    if academic_session_id is None:
        query = query.filter(
            ReportCardTemplate.academic_session_id.is_(None)
        )
    else:
        query = query.filter(
            ReportCardTemplate.academic_session_id
            == academic_session_id
        )

    if exam_id is None:
        query = query.filter(
            ReportCardTemplate.exam_id.is_(None)
        )
    else:
        query = query.filter(
            ReportCardTemplate.exam_id == exam_id
        )

    if except_id is not None:
        query = query.filter(
            ReportCardTemplate.id != except_id
        )

    templates = query.all()

    for template in templates:
        template.is_default = False


def _check_duplicate_name(
    db: Session,
    *,
    name: str,
    exclude_id: int | None = None,
) -> None:
    query = db.query(ReportCardTemplate).filter(
        ReportCardTemplate.name == name
    )

    if exclude_id is not None:
        query = query.filter(
            ReportCardTemplate.id != exclude_id
        )

    existing = query.first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Report card template '{name}' already exists.",
        )


# ---------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[ReportCardTemplateResponse],
)
def list_report_card_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    templates = (
        db.query(ReportCardTemplate)
        .order_by(
            ReportCardTemplate.is_default.desc(),
            ReportCardTemplate.updated_at.desc(),
            ReportCardTemplate.id.desc(),
        )
        .all()
    )

    return templates


# ---------------------------------------------------------------------
# GET ONE
# ---------------------------------------------------------------------

@router.get(
    "/{template_id}",
    response_model=ReportCardTemplateResponse,
)
def get_report_card_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    template = (
        db.query(ReportCardTemplate)
        .filter(
            ReportCardTemplate.id == template_id
        )
        .first()
    )

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report card template not found.",
        )

    return template


# ---------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------

@router.post(
    "/",
    response_model=ReportCardTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_report_card_template(
    payload: ReportCardTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    _check_duplicate_name(
        db,
        name=payload.name,
    )

    # If this template is being created as default,
    # remove default from the same scope first.
    if payload.is_default:
        _unset_defaults(
            db,
            class_id=payload.class_id,
            academic_session_id=payload.academic_session_id,
            exam_id=payload.exam_id,
        )

    template = ReportCardTemplate(
        name=payload.name,
        description=payload.description,
        class_id=payload.class_id,
        academic_session_id=payload.academic_session_id,
        exam_id=payload.exam_id,
        page_size=payload.page_size,
        orientation=payload.orientation,
        status=payload.status,
        is_default=payload.is_default,
        elements=payload.elements,
        settings=payload.settings,
        created_by=current_user.id,
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return template


# ---------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------

@router.put(
    "/{template_id}",
    response_model=ReportCardTemplateResponse,
)
def update_report_card_template(
    template_id: int,
    payload: ReportCardTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    template = (
        db.query(ReportCardTemplate)
        .filter(
            ReportCardTemplate.id == template_id
        )
        .first()
    )

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report card template not found.",
        )

    update_data = payload.model_dump(
        exclude_unset=True
    )

    if "name" in update_data:
        _check_duplicate_name(
            db,
            name=update_data["name"],
            exclude_id=template.id,
        )

    # Calculate the future scope. This matters when the user
    # changes class/session/exam while making the template default.
    future_class_id = update_data.get(
        "class_id",
        template.class_id,
    )

    future_academic_session_id = update_data.get(
        "academic_session_id",
        template.academic_session_id,
    )

    future_exam_id = update_data.get(
        "exam_id",
        template.exam_id,
    )

    future_is_default = update_data.get(
        "is_default",
        template.is_default,
    )

    if future_is_default:
        _unset_defaults(
            db,
            class_id=future_class_id,
            academic_session_id=future_academic_session_id,
            exam_id=future_exam_id,
            except_id=template.id,
        )

    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)

    return template


# ---------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------

@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_report_card_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    template = (
        db.query(ReportCardTemplate)
        .filter(
            ReportCardTemplate.id == template_id
        )
        .first()
    )

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report card template not found.",
        )

    db.delete(template)
    db.commit()

    return None


# ---------------------------------------------------------------------
# DUPLICATE
# ---------------------------------------------------------------------

@router.post(
    "/{template_id}/duplicate",
    response_model=ReportCardTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_report_card_template(
    template_id: int,
    payload: ReportCardTemplateDuplicateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    original = (
        db.query(ReportCardTemplate)
        .filter(
            ReportCardTemplate.id == template_id
        )
        .first()
    )

    if original is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report card template not found.",
        )

    new_name = payload.name

    if not new_name:
        new_name = f"{original.name} Copy"

        counter = 2

        while (
            db.query(ReportCardTemplate)
            .filter(
                ReportCardTemplate.name == new_name
            )
            .first()
            is not None
        ):
            new_name = f"{original.name} Copy {counter}"
            counter += 1

    _check_duplicate_name(
        db,
        name=new_name,
    )

    # Duplicated template should start as non-default.
    duplicate = ReportCardTemplate(
        name=new_name,
        description=original.description,
        class_id=original.class_id,
        academic_session_id=original.academic_session_id,
        exam_id=original.exam_id,
        page_size=original.page_size,
        orientation=original.orientation,
        status="DRAFT",
        is_default=False,
        elements=list(original.elements or []),
        settings=dict(original.settings or {}),
        created_by=current_user.id,
    )

    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)

    return duplicate


# ---------------------------------------------------------------------
# SET DEFAULT
# ---------------------------------------------------------------------

@router.post(
    "/{template_id}/set-default",
    response_model=ReportCardTemplateDefaultResponse,
)
def set_default_report_card_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    template = (
        db.query(ReportCardTemplate)
        .filter(
            ReportCardTemplate.id == template_id
        )
        .first()
    )

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report card template not found.",
        )

    _unset_defaults(
        db,
        class_id=template.class_id,
        academic_session_id=template.academic_session_id,
        exam_id=template.exam_id,
        except_id=template.id,
    )

    template.is_default = True

    db.commit()
    db.refresh(template)

    return template