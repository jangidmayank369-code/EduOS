from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import (
    CoScholasticComponent,
    CoScholasticEntry,
    Student,
)
from app.schemas.co_scholastic import (
    CoScholasticBulkRequest,
    CoScholasticComponentCreate,
    CoScholasticComponentResponse,
    CoScholasticComponentUpdate,
    CoScholasticEntryCreate,
    CoScholasticEntryResponse,
    CoScholasticEntryUpdate,
    CoScholasticStudentResult,
)


router = APIRouter(
    prefix="/co-scholastic",
    tags=["Co-Scholastic"],
)


VALID_COMPONENT_TYPES = {
    "MARKS",
    "GRADE",
    "REMARK",
}


def validate_component_type(component_type: str) -> str:
    value = component_type.strip().upper()

    if value not in VALID_COMPONENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid component type. "
                "Allowed values: MARKS, GRADE, REMARK"
            ),
        )

    return value


def validate_marks(
    component: CoScholasticComponent,
    marks: float | None,
) -> None:
    if marks is None:
        return

    if component.component_type != "MARKS":
        raise HTTPException(
            status_code=400,
            detail=(
                "Marks can only be entered for a MARKS "
                "type co-scholastic component."
            ),
        )

    if component.max_marks is not None and marks > component.max_marks:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Marks cannot exceed maximum marks "
                f"({component.max_marks})."
            ),
        )


@router.post(
    "/components",
    response_model=CoScholasticComponentResponse,
)
def create_component(
    data: CoScholasticComponentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    component_type = validate_component_type(data.component_type)

    existing = (
        db.query(CoScholasticComponent)
        .filter(
            CoScholasticComponent.class_id == data.class_id,
            CoScholasticComponent.name == data.name,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Co-scholastic component already exists for this class.",
        )

    if component_type == "MARKS" and data.max_marks is None:
        raise HTTPException(
            status_code=400,
            detail="max_marks is required for MARKS type component.",
        )

    if component_type != "MARKS":
        data.max_marks = None

    component = CoScholasticComponent(
        class_id=data.class_id,
        name=data.name.strip(),
        component_type=component_type,
        max_marks=data.max_marks,
        include_in_result=data.include_in_result,
        display_order=data.display_order,
        is_active=data.is_active,
    )

    db.add(component)
    db.commit()
    db.refresh(component)

    return component


@router.get(
    "/components",
    response_model=list[CoScholasticComponentResponse],
)
def get_components(
    class_id: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(CoScholasticComponent).filter(
        CoScholasticComponent.is_active == True
    )

    if class_id is not None:
        query = query.filter(
            CoScholasticComponent.class_id == class_id
        )

    return query.order_by(
        CoScholasticComponent.display_order,
        CoScholasticComponent.id,
    ).all()


@router.get(
    "/components/{component_id}",
    response_model=CoScholasticComponentResponse,
)
def get_component(
    component_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    component = (
        db.query(CoScholasticComponent)
        .filter(CoScholasticComponent.id == component_id)
        .first()
    )

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic component not found.",
        )

    return component


@router.put(
    "/components/{component_id}",
    response_model=CoScholasticComponentResponse,
)
def update_component(
    component_id: int,
    data: CoScholasticComponentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    component = (
        db.query(CoScholasticComponent)
        .filter(CoScholasticComponent.id == component_id)
        .first()
    )

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic component not found.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "component_type" in update_data:
        update_data["component_type"] = validate_component_type(
            update_data["component_type"]
        )

    new_type = update_data.get(
        "component_type",
        component.component_type,
    )

    new_max_marks = update_data.get(
        "max_marks",
        component.max_marks,
    )

    if new_type == "MARKS" and new_max_marks is None:
        raise HTTPException(
            status_code=400,
            detail="max_marks is required for MARKS type component.",
        )

    if new_type != "MARKS":
        update_data["max_marks"] = None

    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()

    if "name" in update_data:
        duplicate = (
            db.query(CoScholasticComponent)
            .filter(
                CoScholasticComponent.class_id == component.class_id,
                CoScholasticComponent.name == update_data["name"],
                CoScholasticComponent.id != component_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Another co-scholastic component with this "
                    "name already exists for this class."
                ),
            )

    for field, value in update_data.items():
        setattr(component, field, value)

    db.commit()
    db.refresh(component)

    return component


@router.delete(
    "/components/{component_id}",
    response_model=CoScholasticComponentResponse,
)
def deactivate_component(
    component_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    component = (
        db.query(CoScholasticComponent)
        .filter(CoScholasticComponent.id == component_id)
        .first()
    )

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic component not found.",
        )

    component.is_active = False

    db.commit()
    db.refresh(component)

    return component


@router.post(
    "/entries",
    response_model=CoScholasticEntryResponse,
)
def create_entry(
    data: CoScholasticEntryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    component = (
        db.query(CoScholasticComponent)
        .filter(
            CoScholasticComponent.id == data.component_id,
            CoScholasticComponent.is_active == True,
        )
        .first()
    )

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic component not found.",
        )

    student = (
        db.query(Student)
        .filter(Student.id == data.student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    validate_marks(component, data.marks)

    existing = (
        db.query(CoScholasticEntry)
        .filter(
            CoScholasticEntry.component_id == data.component_id,
            CoScholasticEntry.student_id == data.student_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Co-scholastic entry already exists for this student.",
        )

    entry = CoScholasticEntry(
        component_id=data.component_id,
        student_id=data.student_id,
        marks=data.marks,
        grade=data.grade,
        remark=data.remark,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry


@router.get(
    "/entries/{entry_id}",
    response_model=CoScholasticEntryResponse,
)
def get_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    entry = (
        db.query(CoScholasticEntry)
        .filter(CoScholasticEntry.id == entry_id)
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic entry not found.",
        )

    return entry


@router.put(
    "/entries/{entry_id}",
    response_model=CoScholasticEntryResponse,
)
def update_entry(
    entry_id: int,
    data: CoScholasticEntryUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    entry = (
        db.query(CoScholasticEntry)
        .filter(CoScholasticEntry.id == entry_id)
        .first()
    )

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic entry not found.",
        )

    component = (
        db.query(CoScholasticComponent)
        .filter(CoScholasticComponent.id == entry.component_id)
        .first()
    )

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic component not found.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "marks" in update_data:
        validate_marks(
            component,
            update_data["marks"],
        )

    for field, value in update_data.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)

    return entry


@router.post(
    "/entries/bulk",
    response_model=list[CoScholasticEntryResponse],
)
def bulk_save_entries(
    data: CoScholasticBulkRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    component = (
        db.query(CoScholasticComponent)
        .filter(
            CoScholasticComponent.id == data.component_id,
            CoScholasticComponent.is_active == True,
        )
        .first()
    )

    if not component:
        raise HTTPException(
            status_code=404,
            detail="Co-scholastic component not found.",
        )

    results: list[CoScholasticEntry] = []

    for item in data.items:
        student = (
            db.query(Student)
            .filter(Student.id == item.student_id)
            .first()
        )

        if not student:
            raise HTTPException(
                status_code=404,
                detail=f"Student {item.student_id} not found.",
            )

        validate_marks(
            component,
            item.marks,
        )

        entry = (
            db.query(CoScholasticEntry)
            .filter(
                CoScholasticEntry.component_id == data.component_id,
                CoScholasticEntry.student_id == item.student_id,
            )
            .first()
        )

        if entry:
            entry.marks = item.marks
            entry.grade = item.grade
            entry.remark = item.remark
        else:
            entry = CoScholasticEntry(
                component_id=data.component_id,
                student_id=item.student_id,
                marks=item.marks,
                grade=item.grade,
                remark=item.remark,
            )

            db.add(entry)

        results.append(entry)

    db.commit()

    for entry in results:
        db.refresh(entry)

    return results


@router.get(
    "/students/{student_id}",
    response_model=list[CoScholasticStudentResult],
)
def get_student_co_scholastic(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    student = (
        db.query(Student)
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    rows = (
        db.query(
            CoScholasticComponent.id.label("component_id"),
            CoScholasticComponent.name.label("component_name"),
            CoScholasticComponent.component_type.label("component_type"),
            CoScholasticEntry.marks.label("marks"),
            CoScholasticComponent.max_marks.label("max_marks"),
            CoScholasticEntry.grade.label("grade"),
            CoScholasticEntry.remark.label("remark"),
        )
        .outerjoin(
            CoScholasticEntry,
            (
                CoScholasticEntry.component_id
                == CoScholasticComponent.id
            )
            & (
                CoScholasticEntry.student_id
                == student_id
            ),
        )
        .filter(
            CoScholasticComponent.class_id == student.class_id,
            CoScholasticComponent.is_active == True,
        )
        .order_by(
            CoScholasticComponent.display_order,
            CoScholasticComponent.id,
        )
        .all()
    )

    return rows