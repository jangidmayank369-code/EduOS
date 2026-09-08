from __future__ import annotations

import csv
import io
from typing import Any


class BulkImportValidationError(Exception):
    pass


def normalize_value(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, str):
        value = value.strip()

        if value == "":
            return None

        return value

    return value


def parse_csv_file(file_content: bytes) -> list[dict[str, Any]]:
    """
    Parse a CSV file into normalized dictionaries.

    The first row is treated as the header row.
    """

    try:
        text = file_content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise BulkImportValidationError(
            "CSV file must be UTF-8 encoded."
        ) from exc

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise BulkImportValidationError(
            "CSV file must contain a header row."
        )

    headers = [
        header.strip()
        for header in reader.fieldnames
        if header is not None
    ]

    if not headers:
        raise BulkImportValidationError(
            "CSV file contains no valid headers."
        )

    rows: list[dict[str, Any]] = []

    for row in reader:
        normalized_row = {
            key.strip(): normalize_value(value)
            for key, value in row.items()
            if key is not None
        }

        if any(value is not None for value in normalized_row.values()):
            rows.append(normalized_row)

    return rows


def validate_required_fields(
    rows: list[dict[str, Any]],
    required_fields: list[str],
) -> list[dict[str, Any]]:
    """
    Validate required fields for every row.

    Returns row-level validation errors.
    """

    errors: list[dict[str, Any]] = []

    for row_number, row in enumerate(rows, start=2):
        missing_fields = [
            field
            for field in required_fields
            if normalize_value(row.get(field)) is None
        ]

        if missing_fields:
            errors.append(
                {
                    "row_number": row_number,
                    "field": ", ".join(missing_fields),
                    "message": (
                        "Required field(s) missing: "
                        + ", ".join(missing_fields)
                    ),
                }
            )

    return errors


def validate_duplicate_values(
    rows: list[dict[str, Any]],
    field: str,
) -> list[dict[str, Any]]:
    """
    Detect duplicate values inside the uploaded file.
    """

    errors: list[dict[str, Any]] = []
    seen: dict[str, int] = {}

    for row_number, row in enumerate(rows, start=2):
        value = normalize_value(row.get(field))

        if value is None:
            continue

        normalized_value = str(value).strip().lower()

        if normalized_value in seen:
            errors.append(
                {
                    "row_number": row_number,
                    "field": field,
                    "message": (
                        f"Duplicate value '{value}'. "
                        f"First appeared in row {seen[normalized_value]}."
                    ),
                }
            )
        else:
            seen[normalized_value] = row_number

    return errors


def build_validation_preview(
    rows: list[dict[str, Any]],
    required_fields: list[str],
    unique_fields: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build a complete validation preview without modifying the database.
    """

    unique_fields = unique_fields or []

    errors: list[dict[str, Any]] = []

    errors.extend(
        validate_required_fields(
            rows=rows,
            required_fields=required_fields,
        )
    )

    for field in unique_fields:
        errors.extend(
            validate_duplicate_values(
                rows=rows,
                field=field,
            )
        )

    error_row_numbers = {
        error["row_number"]
        for error in errors
    }

    total_rows = len(rows)
    failed_rows = len(error_row_numbers)
    successful_rows = total_rows - failed_rows

    return {
        "total_rows": total_rows,
        "successful_rows": successful_rows,
        "failed_rows": failed_rows,
        "is_valid": failed_rows == 0,
        "errors": errors,
        "preview": rows[:10],
    }