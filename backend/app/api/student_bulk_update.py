from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.models import SchoolClass, Student, User
from app.models.import_job import ImportJob
from app.models.student_status_history import StudentStatusHistory


router = APIRouter(
    prefix="/students/bulk-update",
    tags=["Student Bulk Update"],
)

MAX_ROWS = 5000

MATCH_COLUMN = "admission_number"
UPDATABLE_COLUMNS = [
    "first_name",
    "last_name",
    "date_of_birth",
    "gender",
    "email",
    "phone",
    "address",
    "class_id",
    "status",
    "status_reason",
]
ALL_COLUMNS = [MATCH_COLUMN] + UPDATABLE_COLUMNS

ALLOWED_STATUSES = {
    "ACTIVE",
    "INACTIVE",
    "TRANSFERRED",
    "WITHDRAWN",
    "PASSED_OUT",
    "ALUMNI",
}


class BulkUpdateConfirmRequest(BaseModel):
    import_job_id: int


def clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_optional_date(value: str, field_name: str) -> date | None:
    value = clean(value)
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"{field_name} must use YYYY-MM-DD format.")


def parse_optional_int(value: str, field_name: str) -> int | None:
    value = clean(value)
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        raise ValueError(f"{field_name} must be a valid integer.")


def parse_optional_email(value: str, field_name: str) -> str | None:
    value = clean(value)
    if not value:
        return None
    if "@" not in value or "." not in value.split("@")[-1]:
        raise ValueError(f"{field_name} is not a valid email address.")
    return value.lower()


def normalize_nullable_text(value: str) -> str | None:
    value = clean(value)
    return value if value else None


def serialize_value(value: Any) -> Any:
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return value


def build_change(field: str, old_value: Any, new_value: Any) -> dict[str, Any] | None:
    old_serialized = serialize_value(old_value)
    new_serialized = serialize_value(new_value)

    if old_serialized == new_serialized:
        return None

    return {
        "field": field,
        "old": old_serialized,
        "new": new_serialized,
    }


def validate_row(
    row: dict[str, Any],
    row_number: int,
    db: Session,
    seen_admission_numbers: set[str],
) -> tuple[dict[str, Any] | None, list[str]]:
    errors: list[str] = []

    admission_number = clean(row.get(MATCH_COLUMN))
    if not admission_number:
        return None, ["admission_number is required."]

    if admission_number in seen_admission_numbers:
        errors.append(
            f"Duplicate admission_number in uploaded file: {admission_number}."
        )
    else:
        seen_admission_numbers.add(admission_number)

    student = (
        db.query(Student)
        .filter(Student.admission_number == admission_number)
        .first()
    )
    if not student:
        errors.append(
            f"Student with admission_number '{admission_number}' does not exist."
        )
        return None, errors

    provided_fields = [
        field
        for field in UPDATABLE_COLUMNS
        if field in row and clean(row.get(field)) != ""
    ]

    if not provided_fields:
        errors.append("At least one update field must contain a value.")
        return None, errors

    updates: dict[str, Any] = {}
    changes: list[dict[str, Any]] = []

    if "first_name" in provided_fields:
        first_name = clean(row.get("first_name"))
        if not first_name:
            errors.append("first_name cannot be blank.")
        else:
            updates["first_name"] = first_name
            change = build_change("first_name", student.first_name, first_name)
            if change:
                changes.append(change)

    if "last_name" in provided_fields:
        last_name = clean(row.get("last_name"))
        if not last_name:
            errors.append("last_name cannot be blank.")
        else:
            updates["last_name"] = last_name
            change = build_change("last_name", student.last_name, last_name)
            if change:
                changes.append(change)

    if "date_of_birth" in provided_fields:
        try:
            dob = parse_optional_date(row.get("date_of_birth", ""), "date_of_birth")
            updates["date_of_birth"] = dob.isoformat() if dob else None
            change = build_change("date_of_birth", student.date_of_birth, dob)
            if change:
                changes.append(change)
        except ValueError as exc:
            errors.append(str(exc))

    if "gender" in provided_fields:
        value = normalize_nullable_text(row.get("gender", ""))
        updates["gender"] = value
        change = build_change("gender", student.gender, value)
        if change:
            changes.append(change)

    if "email" in provided_fields:
        try:
            value = parse_optional_email(row.get("email", ""), "email")
            updates["email"] = value
            change = build_change("email", student.email, value)
            if change:
                changes.append(change)
        except ValueError as exc:
            errors.append(str(exc))

    if "phone" in provided_fields:
        value = normalize_nullable_text(row.get("phone", ""))
        updates["phone"] = value
        change = build_change("phone", student.phone, value)
        if change:
            changes.append(change)

    if "address" in provided_fields:
        value = normalize_nullable_text(row.get("address", ""))
        updates["address"] = value
        change = build_change("address", student.address, value)
        if change:
            changes.append(change)

    if "class_id" in provided_fields:
        try:
            class_id = parse_optional_int(row.get("class_id", ""), "class_id")
            if class_id is None:
                errors.append("class_id cannot be blank when supplied.")
            else:
                school_class = (
                    db.query(SchoolClass)
                    .filter(
                        SchoolClass.id == class_id,
                        SchoolClass.is_active == True,  # noqa: E712
                    )
                    .first()
                )
                if not school_class:
                    errors.append(
                        f"Class {class_id} does not exist or is inactive."
                    )
                else:
                    updates["class_id"] = class_id
                    change = build_change("class_id", student.class_id, class_id)
                    if change:
                        changes.append(change)
        except ValueError as exc:
            errors.append(str(exc))

    status_supplied = "status" in provided_fields
    reason_supplied = "status_reason" in provided_fields

    if status_supplied:
        status = clean(row.get("status")).upper()
        if status not in ALLOWED_STATUSES:
            errors.append(
                "status must be one of: "
                + ", ".join(sorted(ALLOWED_STATUSES))
                + "."
            )
        else:
            current_status = serialize_value(student.status)
            if status != current_status:
                reason = clean(row.get("status_reason"))
                if not reason:
                    errors.append(
                        "status_reason is required when changing student status."
                    )
                updates["status"] = status
                updates["status_reason"] = reason or None
                change = build_change("status", current_status, status)
                if change:
                    changes.append(change)
                reason_change = build_change(
                    "status_reason",
                    student.status_reason,
                    reason or None,
                )
                if reason_change:
                    changes.append(reason_change)
            elif reason_supplied:
                errors.append(
                    "status_reason cannot be changed without changing status."
                )
    elif reason_supplied:
        errors.append("status must be supplied when status_reason is supplied.")

    if errors:
        return None, errors

    if not changes:
        errors.append("This row does not change any existing student data.")
        return None, errors

    return (
        {
            "row_number": row_number,
            "student_id": student.id,
            "admission_number": admission_number,
            "student_name": f"{student.first_name} {student.last_name}",
            "updates": updates,
            "changes": changes,
        },
        [],
    )


@router.get("/template")
def download_bulk_update_template(
    current_user: User = Depends(require_role("admin")),
):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=ALL_COLUMNS)
    writer.writeheader()

    writer.writerow(
        {
            "admission_number": "STU-001",
            "first_name": "Aarav",
            "last_name": "Sharma",
            "date_of_birth": "2012-05-10",
            "gender": "Male",
            "email": "aarav.new@example.com",
            "phone": "9876543210",
            "address": "Jaipur, Rajasthan",
            "class_id": "2",
            "status": "",
            "status_reason": "",
        }
    )
    writer.writerow(
        {
            "admission_number": "STU-002",
            "first_name": "",
            "last_name": "",
            "date_of_birth": "",
            "gender": "",
            "email": "",
            "phone": "9876543211",
            "address": "",
            "class_id": "",
            "status": "INACTIVE",
            "status_reason": "Temporary inactive status",
        }
    )

    content = output.getvalue()
    output.close()

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8-sig")),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                'attachment; filename="student_bulk_update_template.csv"'
            )
        },
    )


@router.post("/preview")
async def preview_bulk_update(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    filename = file.filename or ""

    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported for student bulk update.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="CSV must be UTF-8 encoded.",
        )

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing.")

    headers = [
        clean(header).lower()
        for header in reader.fieldnames
        if header is not None
    ]

    if MATCH_COLUMN not in headers:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Required matching column is missing.",
                "missing_columns": [MATCH_COLUMN],
                "allowed_columns": ALL_COLUMNS,
            },
        )

    unknown_columns = [
        column for column in headers if column not in ALL_COLUMNS
    ]

    rows = list(reader)
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="CSV contains no student rows.",
        )

    if len(rows) > MAX_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_ROWS} rows are allowed per update.",
        )

    seen: set[str] = set()
    valid_rows: list[dict[str, Any]] = []
    validation_errors: list[dict[str, Any]] = []

    for index, raw_row in enumerate(rows, start=2):
        normalized_row = {
            clean(key).lower(): clean(value)
            for key, value in raw_row.items()
            if key is not None
        }

        validated_row, errors = validate_row(
            normalized_row,
            index,
            db,
            seen,
        )

        if errors:
            validation_errors.append(
                {
                    "row_number": index,
                    "admission_number": normalized_row.get(
                        "admission_number", ""
                    ),
                    "errors": errors,
                    "data": normalized_row,
                }
            )
        else:
            valid_rows.append(validated_row)

    import_job = ImportJob(
        module="student_bulk_update",
        file_name=filename,
        status="PREVIEWED",
        total_rows=len(rows),
        successful_rows=0,
        failed_rows=len(validation_errors),
        error_details=[
            {
                "validated_rows": valid_rows,
                "validation_errors": validation_errors,
                "unknown_columns": unknown_columns,
            }
        ],
        uploaded_by_user_id=current_user.id,
    )
    db.add(import_job)
    db.commit()
    db.refresh(import_job)

    return {
        "module": "student_bulk_update",
        "file_name": filename,
        "import_job_id": import_job.id,
        "total_rows": len(rows),
        "valid_rows": len(valid_rows),
        "failed_rows": len(validation_errors),
        "can_update": (
            len(rows) > 0
            and len(validation_errors) == 0
            and len(valid_rows) == len(rows)
        ),
        "unknown_columns": unknown_columns,
        "errors": validation_errors,
        "preview": valid_rows,
    }


@router.post("/confirm")
def confirm_bulk_update(
    data: BulkUpdateConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    import_job = (
        db.query(ImportJob)
        .filter(ImportJob.id == data.import_job_id)
        .first()
    )

    if not import_job:
        raise HTTPException(status_code=404, detail="Import job not found.")

    if import_job.module != "student_bulk_update":
        raise HTTPException(
            status_code=400,
            detail="This import job is not a student bulk update.",
        )

    if import_job.uploaded_by_user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot confirm another user's bulk update.",
        )

    if import_job.status != "PREVIEWED":
        raise HTTPException(
            status_code=400,
            detail=(
                "Bulk update cannot be confirmed because its status is "
                f"{import_job.status}."
            ),
        )

    if import_job.failed_rows != 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Bulk update contains validation errors. "
                "Fix the CSV and preview again."
            ),
        )

    payload = import_job.error_details or []
    if not payload or not isinstance(payload, list):
        raise HTTPException(
            status_code=400,
            detail="Validated bulk update data is missing.",
        )

    validated_rows = payload[0].get("validated_rows", [])
    if not validated_rows:
        raise HTTPException(
            status_code=400,
            detail="There are no validated rows to update.",
        )

    # No commit before the transaction work: either every student update
    # succeeds or the full update is rolled back.
    import_job.status = "PROCESSING"

    updated_students: list[dict[str, Any]] = []

    try:
        for row in validated_rows:
            student = (
                db.query(Student)
                .filter(
                    Student.id == row["student_id"],
                    Student.admission_number == row["admission_number"],
                )
                .first()
            )

            if not student:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Student '{row['admission_number']}' changed or "
                        "was removed after preview. Preview the CSV again."
                    ),
                )

            updates = row["updates"]

            if "class_id" in updates:
                school_class = (
                    db.query(SchoolClass)
                    .filter(
                        SchoolClass.id == updates["class_id"],
                        SchoolClass.is_active == True,  # noqa: E712
                    )
                    .first()
                )
                if not school_class:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Class {updates['class_id']} is no longer active. "
                            "Preview the CSV again."
                        ),
                    )

            if "first_name" in updates:
                student.first_name = updates["first_name"]

            if "last_name" in updates:
                student.last_name = updates["last_name"]

            if "date_of_birth" in updates:
                student.date_of_birth = (
                    date.fromisoformat(updates["date_of_birth"])
                    if updates["date_of_birth"]
                    else None
                )

            if "gender" in updates:
                student.gender = updates["gender"]

            if "email" in updates:
                student.email = updates["email"]

            if "phone" in updates:
                student.phone = updates["phone"]

            if "address" in updates:
                student.address = updates["address"]

            if "class_id" in updates:
                student.class_id = updates["class_id"]

            if "status" in updates:
                old_status = serialize_value(student.status)
                new_status = updates["status"]
                reason = updates.get("status_reason")

                if old_status != new_status:
                    history = StudentStatusHistory(
                        student_id=student.id,
                        old_status=old_status,
                        new_status=new_status,
                        reason=reason,
                        changed_at=datetime.utcnow(),
                        changed_by_user_id=current_user.id,
                    )
                    db.add(history)

                    student.status = new_status
                    student.status_reason = reason
                    student.status_changed_at = datetime.utcnow()
                    student.is_active = new_status == "ACTIVE"

                    # Keep the linked login account synchronized with the
                    # student's lifecycle status.
                    if student.user_id:
                        linked_user = (
                            db.query(User)
                            .filter(User.id == student.user_id)
                            .first()
                        )
                        if linked_user:
                            linked_user.is_active = student.is_active

            updated_students.append(
                {
                    "student_id": student.id,
                    "admission_number": student.admission_number,
                    "changes": row["changes"],
                }
            )

        import_job.status = "COMPLETED"
        import_job.successful_rows = len(updated_students)
        import_job.failed_rows = 0
        import_job.completed_at = datetime.utcnow()

        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Student bulk update failed and was rolled back: {exc}",
        )

    return {
        "message": "Student bulk update completed successfully.",
        "import_job_id": import_job.id,
        "updated_rows": len(updated_students),
        "students": updated_students,
    }
