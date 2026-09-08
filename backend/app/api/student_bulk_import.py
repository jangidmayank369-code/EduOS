from __future__ import annotations

import csv
import io
import secrets
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_role
from app.core.database import get_db
from app.core.security import hash_password
from app.models import (
    AcademicSession,
    Parent,
    ParentChild,
    SchoolClass,
    Student,
    StudentEnrollment,
    User,
)
from app.models.admission_application import AdmissionApplication
from app.models.import_job import ImportJob
from app.services.parent_invitation_service import create_parent_invitation


router = APIRouter(
    prefix="/students/bulk-import",
    tags=["Student Bulk Import"],
)


MAX_ROWS = 5000

REQUIRED_COLUMNS = [
    "admission_number",
    "first_name",
    "last_name",
    "academic_session_id",
    "class_id",
]

OPTIONAL_COLUMNS = [
    "date_of_birth",
    "gender",
    "email",
    "phone",
    "address",
    "roll_number",
    "enrollment_date",
    "application_number",
    "parent_first_name",
    "parent_last_name",
    "parent_relation",
    "parent_phone",
    "parent_email",
    "parent_is_primary",
    "parent_is_emergency_contact",
    "parent_receives_notifications",
]

ALL_COLUMNS = REQUIRED_COLUMNS + OPTIONAL_COLUMNS


class MasterImportConfirmRequest(BaseModel):
    import_job_id: int


def clean(value: Any) -> str:
    if value is None:
        return ""

    return str(value).strip()


def parse_bool(value: str, default: bool = False) -> bool:
    value = clean(value).lower()

    if value == "":
        return default

    if value in {"true", "1", "yes", "y"}:
        return True

    if value in {"false", "0", "no", "n"}:
        return False

    raise ValueError("Expected true/false")


def parse_optional_date(value: str, field_name: str) -> date | None:
    value = clean(value)

    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(
            f"{field_name} must use YYYY-MM-DD format."
        )


def parse_email(value: str, field_name: str) -> str | None:
    value = clean(value)

    if not value:
        return None

    if "@" not in value or "." not in value.split("@")[-1]:
        raise ValueError(f"{field_name} is not a valid email address.")

    return value.lower()


def parse_int(value: str, field_name: str) -> int | None:
    value = clean(value)

    if not value:
        return None

    try:
        return int(value)
    except ValueError:
        raise ValueError(f"{field_name} must be a valid integer.")


def parse_row(
    row: dict[str, Any],
    row_number: int,
    db: Session,
    seen_admission_numbers: set[str],
) -> tuple[dict[str, Any] | None, list[str]]:
    errors: list[str] = []

    admission_number = clean(row.get("admission_number"))
    first_name = clean(row.get("first_name"))
    last_name = clean(row.get("last_name"))

    if not admission_number:
        errors.append("admission_number is required.")

    if not first_name:
        errors.append("first_name is required.")

    if not last_name:
        errors.append("last_name is required.")

    if admission_number:
        if admission_number in seen_admission_numbers:
            errors.append(
                f"Duplicate admission_number in uploaded file: {admission_number}."
            )

        existing_student = (
            db.query(Student)
            .filter(Student.admission_number == admission_number)
            .first()
        )

        if existing_student:
            errors.append(
                f"Student with admission_number '{admission_number}' already exists."
            )

    academic_session_id = parse_int(
        clean(row.get("academic_session_id")),
        "academic_session_id",
    )

    class_id = parse_int(
        clean(row.get("class_id")),
        "class_id",
    )

    if academic_session_id is None:
        errors.append("academic_session_id is required.")
    else:
        session = (
            db.query(AcademicSession)
            .filter(AcademicSession.id == academic_session_id)
            .first()
        )

        if not session:
            errors.append(
                f"Academic session {academic_session_id} does not exist."
            )

    if class_id is None:
        errors.append("class_id is required.")
    else:
        school_class = (
            db.query(SchoolClass)
            .filter(SchoolClass.id == class_id)
            .first()
        )

        if not school_class:
            errors.append(f"Class {class_id} does not exist.")

    try:
        date_of_birth = parse_optional_date(
            clean(row.get("date_of_birth")),
            "date_of_birth",
        )
    except ValueError as exc:
        errors.append(str(exc))
        date_of_birth = None

    try:
        enrollment_date = parse_optional_date(
            clean(row.get("enrollment_date")),
            "enrollment_date",
        )
    except ValueError as exc:
        errors.append(str(exc))
        enrollment_date = None

    try:
        email = parse_email(clean(row.get("email")), "email")
    except ValueError as exc:
        errors.append(str(exc))
        email = None

    try:
        parent_email = parse_email(
            clean(row.get("parent_email")),
            "parent_email",
        )
    except ValueError as exc:
        errors.append(str(exc))
        parent_email = None

    parent_first_name = clean(row.get("parent_first_name"))
    parent_last_name = clean(row.get("parent_last_name"))
    parent_phone = clean(row.get("parent_phone"))
    parent_relation = clean(row.get("parent_relation"))

    has_parent_data = any(
        [
            parent_first_name,
            parent_last_name,
            parent_phone,
            parent_email,
            parent_relation,
        ]
    )

    if has_parent_data:
        if not parent_first_name:
            errors.append(
                "parent_first_name is required when parent information is supplied."
            )

        if not parent_last_name:
            errors.append(
                "parent_last_name is required when parent information is supplied."
            )

        if not parent_email:
            errors.append(
                "parent_email is required so EduOS can create/link the parent account."
            )

        if not parent_relation:
            errors.append(
                "parent_relation is required when parent information is supplied."
            )

    application_number = clean(row.get("application_number"))

    application = None

    if application_number:
        application = (
            db.query(AdmissionApplication)
            .filter(
                AdmissionApplication.application_number
                == application_number
            )
            .first()
        )

        if not application:
            errors.append(
                f"Admission application '{application_number}' does not exist."
            )
        else:
            if application.student_id is not None:
                errors.append(
                    f"Admission application '{application_number}' is already linked to a student."
                )

            if application.status != "APPROVED":
                errors.append(
                    f"Admission application '{application_number}' must be APPROVED before import."
                )

    try:
        parent_is_primary = parse_bool(
            clean(row.get("parent_is_primary")),
            default=True,
        )
    except ValueError as exc:
        errors.append(f"parent_is_primary: {exc}")
        parent_is_primary = True

    try:
        parent_is_emergency_contact = parse_bool(
            clean(row.get("parent_is_emergency_contact")),
            default=True,
        )
    except ValueError as exc:
        errors.append(
            f"parent_is_emergency_contact: {exc}"
        )
        parent_is_emergency_contact = True

    try:
        parent_receives_notifications = parse_bool(
            clean(row.get("parent_receives_notifications")),
            default=True,
        )
    except ValueError as exc:
        errors.append(
            f"parent_receives_notifications: {exc}"
        )
        parent_receives_notifications = True

    if errors:
        return None, errors

    seen_admission_numbers.add(admission_number)

    return (
        {
            "row_number": row_number,
            "admission_number": admission_number,
            "first_name": first_name,
            "last_name": last_name,
            "date_of_birth": (
                date_of_birth.isoformat()
                if date_of_birth
                else None
            ),
            "gender": clean(row.get("gender")) or None,
            "email": email,
            "phone": clean(row.get("phone")) or None,
            "address": clean(row.get("address")) or None,
            "academic_session_id": academic_session_id,
            "class_id": class_id,
            "roll_number": clean(row.get("roll_number")) or None,
            "enrollment_date": (
                enrollment_date.isoformat()
                if enrollment_date
                else date.today().isoformat()
            ),
            "application_number": application_number or None,
            "parent": (
                {
                    "first_name": parent_first_name,
                    "last_name": parent_last_name,
                    "relation_type": parent_relation,
                    "phone": parent_phone or None,
                    "email": parent_email,
                    "is_primary": parent_is_primary,
                    "is_emergency_contact": parent_is_emergency_contact,
                    "receives_notifications": parent_receives_notifications,
                }
                if has_parent_data
                else None
            ),
        },
        [],
    )


@router.get("/template")
def download_master_student_template(
    current_user: User = Depends(require_role("admin")),
):
    output = io.StringIO()

    writer = csv.DictWriter(
        output,
        fieldnames=ALL_COLUMNS,
    )

    writer.writeheader()

    writer.writerow(
        {
            "admission_number": "STU-001",
            "first_name": "Aarav",
            "last_name": "Sharma",
            "date_of_birth": "2012-05-10",
            "gender": "Male",
            "email": "aarav@example.com",
            "phone": "9876543210",
            "address": "Jaipur, Rajasthan",
            "academic_session_id": "1",
            "class_id": "1",
            "roll_number": "12",
            "enrollment_date": "2026-04-01",
            "application_number": "",
            "parent_first_name": "Amit",
            "parent_last_name": "Sharma",
            "parent_relation": "FATHER",
            "parent_phone": "9876501234",
            "parent_email": "amit@example.com",
            "parent_is_primary": "true",
            "parent_is_emergency_contact": "true",
            "parent_receives_notifications": "true",
        }
    )

    writer.writerow(
        {
            "admission_number": "STU-002",
            "first_name": "Ananya",
            "last_name": "Verma",
            "date_of_birth": "2013-08-21",
            "gender": "Female",
            "email": "ananya@example.com",
            "phone": "9876543211",
            "address": "Jaipur, Rajasthan",
            "academic_session_id": "1",
            "class_id": "1",
            "roll_number": "13",
            "enrollment_date": "2026-04-01",
            "application_number": "",
            "parent_first_name": "Rajesh",
            "parent_last_name": "Verma",
            "parent_relation": "FATHER",
            "parent_phone": "9876501235",
            "parent_email": "rajesh@example.com",
            "parent_is_primary": "true",
            "parent_is_emergency_contact": "true",
            "parent_receives_notifications": "true",
        }
    )

    content = output.getvalue()
    output.close()

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8-sig")),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                'attachment; filename="student_master_import_template.csv"'
            )
        },
    )


@router.post("/preview")
async def preview_master_student_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    filename = file.filename or ""

    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported for master student import.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="CSV must be UTF-8 encoded.",
        )

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV header row is missing.",
        )

    headers = [
        clean(header).lower()
        for header in reader.fieldnames
        if header is not None
    ]

    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in headers
    ]

    unknown_columns = [
        column
        for column in headers
        if column not in ALL_COLUMNS
    ]

    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Required columns are missing.",
                "missing_columns": missing_columns,
                "allowed_columns": ALL_COLUMNS,
            },
        )

    rows = list(reader)

    if len(rows) > MAX_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_ROWS} rows are allowed per import.",
        )

    seen_admission_numbers: set[str] = set()
    valid_rows: list[dict[str, Any]] = []
    validation_errors: list[dict[str, Any]] = []

    for index, raw_row in enumerate(rows, start=2):
        normalized_row = {
            clean(key).lower(): clean(value)
            for key, value in raw_row.items()
            if key is not None
        }

        validated_row, errors = parse_row(
            normalized_row,
            index,
            db,
            seen_admission_numbers,
        )

        if errors:
            validation_errors.append(
                {
                    "row_number": index,
                    "errors": errors,
                    "data": normalized_row,
                }
            )
        else:
            valid_rows.append(validated_row)

    import_job = ImportJob(
        module="student_master_import",
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
        "module": "student_master_import",
        "file_name": filename,
        "import_job_id": import_job.id,
        "total_rows": len(rows),
        "valid_rows": len(valid_rows),
        "failed_rows": len(validation_errors),
        "can_import": (
            len(rows) > 0
            and len(validation_errors) == 0
        ),
        "unknown_columns": unknown_columns,
        "errors": validation_errors,
        "preview": valid_rows,
    }


def create_or_get_parent(
    db: Session,
    parent_data: dict[str, Any],
) -> tuple[Parent, str | None]:
    email = parent_data["email"].lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    invitation_token: str | None = None

    if user:
        if user.role != "parent":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Email '{email}' already belongs to "
                    f"a non-parent user."
                ),
            )
    else:
        unusable_password = secrets.token_urlsafe(32)

        user = User(
            email=email,
            password_hash=hash_password(unusable_password),
            role="parent",
            is_active=False,
        )

        db.add(user)
        db.flush()

        invitation_token = create_parent_invitation(
            db=db,
            user=user,
        )

    parent = (
        db.query(Parent)
        .filter(Parent.user_id == user.id)
        .first()
    )

    if not parent:
        parent = Parent(
            user_id=user.id,
            first_name=parent_data["first_name"],
            last_name=parent_data["last_name"],
            phone=parent_data.get("phone"),
            is_active=True,
        )

        db.add(parent)
        db.flush()
    else:
        parent.first_name = parent_data["first_name"]
        parent.last_name = parent_data["last_name"]

        if parent_data.get("phone"):
            parent.phone = parent_data["phone"]

        parent.is_active = True

    return parent, invitation_token


@router.post("/confirm")
def confirm_master_student_import(
    data: MasterImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    import_job = (
        db.query(ImportJob)
        .filter(ImportJob.id == data.import_job_id)
        .first()
    )

    if not import_job:
        raise HTTPException(
            status_code=404,
            detail="Import job not found.",
        )

    if import_job.module != "student_master_import":
        raise HTTPException(
            status_code=400,
            detail="This import job is not a master student import.",
        )

    if import_job.uploaded_by_user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot confirm another user's import job.",
        )

    if import_job.status != "PREVIEWED":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Import job cannot be confirmed because its "
                f"status is {import_job.status}."
            ),
        )

    if import_job.failed_rows != 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Import contains validation errors. "
                "Fix them and upload again before confirming."
            ),
        )

    payload = import_job.error_details or []

    if not payload or not isinstance(payload, list):
        raise HTTPException(
            status_code=400,
            detail="Validated import data is missing.",
        )

    validated_rows = payload[0].get("validated_rows", [])

    if not validated_rows:
        raise HTTPException(
            status_code=400,
            detail="There are no validated rows to import.",
        )

    import_job.status = "PROCESSING"
    db.commit()

    created_students: list[Student] = []
    parent_invitations: list[dict[str, Any]] = []

    try:
        for row in validated_rows:
            admission_number = row["admission_number"]

            existing_student = (
                db.query(Student)
                .filter(
                    Student.admission_number
                    == admission_number
                )
                .first()
            )

            if existing_student:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Student '{admission_number}' "
                        f"was created after preview. "
                        f"Please preview the file again."
                    ),
                )

            session = (
                db.query(AcademicSession)
                .filter(
                    AcademicSession.id
                    == row["academic_session_id"]
                )
                .first()
            )

            if not session:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Academic session "
                        f"{row['academic_session_id']} no longer exists."
                    ),
                )

            school_class = (
                db.query(SchoolClass)
                .filter(
                    SchoolClass.id == row["class_id"]
                )
                .first()
            )

            if not school_class:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Class {row['class_id']} "
                        f"no longer exists."
                    ),
                )

            dob = (
                date.fromisoformat(row["date_of_birth"])
                if row.get("date_of_birth")
                else None
            )

            enrollment_date = date.fromisoformat(
                row["enrollment_date"]
            )

            student = Student(
                admission_number=admission_number,
                first_name=row["first_name"],
                last_name=row["last_name"],
                date_of_birth=dob,
                gender=row.get("gender"),
                email=row.get("email"),
                phone=row.get("phone"),
                address=row.get("address"),
                class_id=row["class_id"],
            )

            db.add(student)
            db.flush()

            admission_application = None

            if row.get("application_number"):
                admission_application = (
                    db.query(AdmissionApplication)
                    .filter(
                        AdmissionApplication.application_number
                        == row["application_number"]
                    )
                    .first()
                )

                if not admission_application:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Admission application "
                            f"'{row['application_number']}' "
                            f"no longer exists."
                        ),
                    )

                if admission_application.status != "APPROVED":
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Admission application "
                            f"'{row['application_number']}' "
                            f"is no longer approved."
                        ),
                    )

                if admission_application.student_id:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            f"Admission application "
                            f"'{row['application_number']}' "
                            f"is already linked."
                        ),
                    )

                admission_application.student_id = student.id
                admission_application.status = "ADMITTED"
                admission_application.reviewed_at = (
                    datetime.utcnow()
                )
                admission_application.reviewed_by_user_id = (
                    current_user.id
                )

            enrollment = StudentEnrollment(
                student_id=student.id,
                academic_session_id=row["academic_session_id"],
                class_id=row["class_id"],
                admission_application_id=(
                    admission_application.id
                    if admission_application
                    else None
                ),
                roll_number=row.get("roll_number"),
                enrollment_date=enrollment_date,
                status="ACTIVE",
                remarks="Created through master student bulk import",
            )

            db.add(enrollment)

            parent_data = row.get("parent")

            if parent_data:
                parent, invitation_token = create_or_get_parent(
                    db=db,
                    parent_data=parent_data,
                )

                existing_link = (
                    db.query(ParentChild)
                    .filter(
                        ParentChild.parent_id == parent.id,
                        ParentChild.student_id == student.id,
                    )
                    .first()
                )

                if existing_link:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Parent-child relationship "
                            "already exists."
                        ),
                    )

                parent_child = ParentChild(
                    parent_id=parent.id,
                    student_id=student.id,
                    relation_type=parent_data["relation_type"],
                    is_primary=parent_data["is_primary"],
                    is_emergency_contact=parent_data[
                        "is_emergency_contact"
                    ],
                    receives_notifications=parent_data[
                        "receives_notifications"
                    ],
                )

                db.add(parent_child)

                if invitation_token:
                    parent_invitations.append(
                        {
                            "student_admission_number": admission_number,
                            "parent_email": parent_data["email"],
                            "invitation_token": invitation_token,
                        }
                    )

            created_students.append(student)

        db.flush()

        import_job.status = "COMPLETED"
        import_job.successful_rows = len(created_students)
        import_job.failed_rows = 0
        import_job.error_details = None
        import_job.completed_at = datetime.utcnow()

        db.commit()

        return {
            "message": (
                "Master student import completed successfully."
            ),
            "import_job_id": import_job.id,
            "total_rows": import_job.total_rows,
            "successful_rows": import_job.successful_rows,
            "failed_rows": import_job.failed_rows,
            "parent_invitations": parent_invitations,
        }

    except HTTPException as exc:
        db.rollback()

        import_job.status = "FAILED"
        import_job.successful_rows = 0
        import_job.failed_rows = import_job.total_rows
        import_job.error_details = [
            {
                "error": exc.detail,
            }
        ]
        import_job.completed_at = datetime.utcnow()

        db.commit()

        raise

    except Exception as exc:
        db.rollback()

        import_job.status = "FAILED"
        import_job.successful_rows = 0
        import_job.failed_rows = import_job.total_rows
        import_job.error_details = [
            {
                "error": str(exc),
            }
        ]
        import_job.completed_at = datetime.utcnow()

        db.commit()

        raise HTTPException(
            status_code=500,
            detail=(
                "Master student import failed. "
                "No student records were imported."
            ),
        )