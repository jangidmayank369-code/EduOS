from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import SchoolClass, SchoolSection, Teacher
from app.schemas.section import SectionCreate, SectionResponse, SectionUpdate

router = APIRouter(
    prefix="/classes/{class_id}/sections",
    tags=["Sections"],
)


def _get_class(db: Session, class_id: int) -> SchoolClass:
    school_class = (
        db.query(SchoolClass)
        .filter(SchoolClass.id == class_id)
        .first()
    )

    if not school_class:
        raise HTTPException(
            status_code=404,
            detail="Class not found",
        )

    return school_class


def _validate_teacher(
    db: Session,
    teacher_id: int | None,
) -> None:
    if teacher_id is None:
        return

    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.id == teacher_id,
            Teacher.is_active == True,
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=404,
            detail="Active teacher not found",
        )


def _get_section(
    db: Session,
    class_id: int,
    section_id: int,
) -> SchoolSection:
    section = (
        db.query(SchoolSection)
        .filter(
            SchoolSection.id == section_id,
            SchoolSection.class_id == class_id,
        )
        .first()
    )

    if not section:
        raise HTTPException(
            status_code=404,
            detail="Section not found",
        )

    return section


@router.post("/", response_model=SectionResponse)
def create_section(
    class_id: int,
    data: SectionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    school_class = _get_class(db, class_id)

    if not school_class.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot create a section under an inactive class",
        )

    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=422,
            detail="Section name is required",
        )

    existing = (
        db.query(SchoolSection)
        .filter(
            SchoolSection.class_id == class_id,
            SchoolSection.name.ilike(name),
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Section already exists in this class",
        )

    _validate_teacher(db, data.class_teacher_id)

    if data.class_teacher_id is not None:
        teacher_section = (
            db.query(SchoolSection)
            .filter(
                SchoolSection.class_id == class_id,
                SchoolSection.class_teacher_id == data.class_teacher_id,
                SchoolSection.is_active == True,
            )
            .first()
        )
        if teacher_section:
            raise HTTPException(
                status_code=400,
                detail="Teacher is already the class teacher of another section in this class",
            )

    section = SchoolSection(
        class_id=class_id,
        name=name,
        class_teacher_id=data.class_teacher_id,
    )

    db.add(section)
    db.commit()
    db.refresh(section)

    return section


@router.get("/", response_model=list[SectionResponse])
def list_sections(
    class_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    _get_class(db, class_id)

    return (
        db.query(SchoolSection)
        .filter(SchoolSection.class_id == class_id)
        .order_by(SchoolSection.name)
        .all()
    )


@router.get("/{section_id}", response_model=SectionResponse)
def get_section(
    class_id: int,
    section_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    _get_class(db, class_id)
    return _get_section(db, class_id, section_id)


@router.put("/{section_id}", response_model=SectionResponse)
def update_section(
    class_id: int,
    section_id: int,
    data: SectionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    _get_class(db, class_id)
    section = _get_section(db, class_id, section_id)

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        name = (update_data["name"] or "").strip()
        if not name:
            raise HTTPException(
                status_code=422,
                detail="Section name is required",
            )

        existing = (
            db.query(SchoolSection)
            .filter(
                SchoolSection.class_id == class_id,
                SchoolSection.id != section_id,
                SchoolSection.name.ilike(name),
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Section already exists in this class",
            )

        update_data["name"] = name

    if "class_teacher_id" in update_data:
        teacher_id = update_data["class_teacher_id"]
        _validate_teacher(db, teacher_id)

        if teacher_id is not None:
            teacher_section = (
                db.query(SchoolSection)
                .filter(
                    SchoolSection.class_id == class_id,
                    SchoolSection.id != section_id,
                    SchoolSection.class_teacher_id == teacher_id,
                    SchoolSection.is_active == True,
                )
                .first()
            )

            if teacher_section:
                raise HTTPException(
                    status_code=400,
                    detail="Teacher is already the class teacher of another section in this class",
                )

    for field, value in update_data.items():
        setattr(section, field, value)

    db.commit()
    db.refresh(section)

    return section


@router.delete("/{section_id}", response_model=SectionResponse)
def deactivate_section(
    class_id: int,
    section_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    _get_class(db, class_id)
    section = _get_section(db, class_id, section_id)

    section.is_active = False

    db.commit()
    db.refresh(section)

    return section
