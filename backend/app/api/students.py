from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import require_role
from app.models import (
    Student,
    SchoolClass,
    StudentStatusHistory,
    ParentChild,
    Parent,
    Attendance,
    Mark,
    Fee,
    Assignment,
)
from app.schemas.student import (
    StudentCreate,
    StudentResponse,
    StudentUpdate,
)
from app.schemas.student_360 import (
    Student360Response,
)

router = APIRouter(
    prefix="/students",
    tags=["Students"],
)

ALLOWED_STUDENT_STATUSES = {
    "ACTIVE",
    "INACTIVE",
    "TRANSFERRED",
    "WITHDRAWN",
    "PASSED_OUT",
    "ALUMNI",
}


def get_status_value(status) -> str:
    if hasattr(status, "value"):
        return status.value
    return str(status)


@router.post("/", response_model=StudentResponse)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing_student = (
        db.query(Student)
        .filter(Student.admission_number == data.admission_number)
        .first()
    )

    if existing_student:
        raise HTTPException(
            status_code=400,
            detail="Admission number is already registered",
        )

    if data.class_id is not None:
        school_class = (
            db.query(SchoolClass)
            .filter(
                SchoolClass.id == data.class_id,
                SchoolClass.is_active.is_(True),
            )
            .first()
        )

        if not school_class:
            raise HTTPException(
                status_code=400,
                detail="Class not found or inactive",
            )

    new_student = Student(
        admission_number=data.admission_number,
        first_name=data.first_name,
        last_name=data.last_name,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        email=data.email,
        phone=data.phone,
        address=data.address,
        class_id=data.class_id,
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return new_student


@router.get("/", response_model=list[StudentResponse])
def get_students(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    students = (
        db.query(Student)
        .filter(Student.is_active.is_(True))
        .all()
    )

    return students


@router.get("/current/active")
def get_active_students(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    students = (
        db.query(Student)
        .filter(
            Student.is_active.is_(True),
            Student.status == "ACTIVE",
        )
        .all()
    )

    return students


@router.get("/{student_id}/360", response_model=Student360Response)
def get_student_360(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """
    Complete Student 360 view.

    Combines all currently available student-related data
    into one response.
    """

    student = (
        db.query(Student)
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found",
        )

    # ---------------------------------------------------------
    # CLASS
    # ---------------------------------------------------------

    school_class = None

    if student.class_id is not None:
        school_class = (
            db.query(SchoolClass)
            .filter(SchoolClass.id == student.class_id)
            .first()
        )

    class_data = None

    if school_class:
        class_data = {
            "id": school_class.id,
            "name": school_class.name,
        }

    # ---------------------------------------------------------
    # PARENTS / GUARDIANS
    # ---------------------------------------------------------

    parent_relationships = (
        db.query(ParentChild)
        .filter(
            ParentChild.student_id == student_id,
        )
        .all()
    )

    parents = []

    for relationship in parent_relationships:
        parent = (
            db.query(Parent)
            .filter(Parent.id == relationship.parent_id)
            .first()
        )

        if not parent:
            continue

        parents.append(
            {
                "parent_id": parent.id,
                "first_name": parent.first_name,
                "last_name": parent.last_name,
                "phone": parent.phone,
                "relation_type": relationship.relation_type,
                "is_primary": relationship.is_primary,
                "is_emergency_contact": relationship.is_emergency_contact,
                "receives_notifications": relationship.receives_notifications,
            }
        )

    # ---------------------------------------------------------
    # STATUS HISTORY
    # ---------------------------------------------------------

    status_history_rows = (
        db.query(StudentStatusHistory)
        .filter(
            StudentStatusHistory.student_id == student_id,
        )
        .order_by(
            StudentStatusHistory.changed_at.desc()
        )
        .all()
    )

    status_history = [
        {
            "id": item.id,
            "old_status": item.old_status,
            "new_status": item.new_status,
            "reason": item.reason,
            "changed_at": item.changed_at,
            "changed_by_user_id": item.changed_by_user_id,
        }
        for item in status_history_rows
    ]

    # ---------------------------------------------------------
    # ATTENDANCE
    # ---------------------------------------------------------

    attendance_rows = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student_id,
        )
        .order_by(
            Attendance.date.desc()
        )
        .all()
    )

    attendance = [
        {
            "id": item.id,
            "student_id": item.student_id,
            "date": item.date,
            "status": item.status,
        }
        for item in attendance_rows
    ]

    # ---------------------------------------------------------
    # MARKS
    # ---------------------------------------------------------

    mark_rows = (
        db.query(Mark)
        .filter(
            Mark.student_id == student_id,
        )
        .order_by(
            Mark.exam_id.desc()
        )
        .all()
    )

    marks = [
        {
            "id": item.id,
            "student_id": item.student_id,
            "exam_id": item.exam_id,
            "subject_id": item.subject_id,
            "marks": item.marks,
        }
        for item in mark_rows
    ]

    # ---------------------------------------------------------
    # FEES
    # ---------------------------------------------------------

    fee_rows = (
        db.query(Fee)
        .filter(
            Fee.student_id == student_id,
        )
        .order_by(
            Fee.id.desc()
        )
        .all()
    )

    fees = [
        {
            "id": item.id,
            "student_id": item.student_id,
            "amount_due": item.amount_due,
            "amount_paid": item.amount_paid,
        }
        for item in fee_rows
    ]

    # ---------------------------------------------------------
    # ASSIGNMENTS
    # ---------------------------------------------------------
    #
    # The current Assignment model is class-based.
    # Therefore we only return assignments belonging to
    # the student's current class.
    #

    assignments = []

    if student.class_id is not None:
        assignment_rows = (
            db.query(Assignment)
            .filter(
                Assignment.class_id == student.class_id,
            )
            .order_by(
                Assignment.id.desc()
            )
            .all()
        )

        assignments = [
            {
                "id": item.id,
                "class_id": item.class_id,
                "subject_id": item.subject_id,
                "title": item.title,
                "description": item.description,
                "due_date": item.due_date,
            }
            for item in assignment_rows
        ]

    # ---------------------------------------------------------
    # DOCUMENTS
    # ---------------------------------------------------------
    #
    # Document module has not been implemented yet.
    # Keep the contract ready without inventing data.
    #

    documents = []

    # ---------------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------------

    return {
        "student": {
            "id": student.id,
            "admission_number": student.admission_number,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "date_of_birth": student.date_of_birth,
            "gender": student.gender,
            "email": student.email,
            "phone": student.phone,
            "address": student.address,
            "class_id": student.class_id,
            "school_class": class_data,
            "is_active": student.is_active,
            "status": get_status_value(student.status),
            "status_changed_at": student.status_changed_at,
            "status_reason": student.status_reason,
            "created_at": student.created_at,
            "updated_at": student.updated_at,
        },
        "parents": parents,
        "status_history": status_history,
        "attendance": attendance,
        "marks": marks,
        "fees": fees,
        "assignments": assignments,
        "documents": documents,
    }


@router.get("/{student_id}/status-history")
def get_student_status_history(
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
            detail="Student not found",
        )

    history = (
        db.query(StudentStatusHistory)
        .filter(
            StudentStatusHistory.student_id == student_id
        )
        .order_by(
            StudentStatusHistory.changed_at.desc()
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "student_id": item.student_id,
            "old_status": item.old_status,
            "new_status": item.new_status,
            "reason": item.reason,
            "changed_at": item.changed_at,
            "changed_by_user_id": item.changed_by_user_id,
        }
        for item in history
    ]


@router.patch("/{student_id}/status", response_model=StudentResponse)
def update_student_status(
    student_id: int,
    status: str,
    reason: str | None = None,
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
            detail="Student not found",
        )

    normalized_status = status.upper().strip()

    if normalized_status not in ALLOWED_STUDENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid student status. Allowed values: "
                "ACTIVE, INACTIVE, TRANSFERRED, WITHDRAWN, "
                "PASSED_OUT, ALUMNI"
            ),
        )

    current_status = get_status_value(student.status)

    if normalized_status == current_status:
        raise HTTPException(
            status_code=400,
            detail="Student already has this status",
        )

    old_status = current_status

    student.status = normalized_status
    student.status_changed_at = datetime.utcnow()
    student.status_reason = reason

    student.is_active = normalized_status == "ACTIVE"

    history_entry = StudentStatusHistory(
        student_id=student.id,
        old_status=old_status,
        new_status=normalized_status,
        reason=reason,
        changed_by_user_id=current_user.id,
    )

    db.add(history_entry)

    db.commit()
    db.refresh(student)

    return student


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
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
            detail="Student not found",
        )

    return student


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    data: StudentUpdate,
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
            detail="Student not found",
        )

    update_data = data.model_dump(
        exclude_unset=True
    )

    if (
        "class_id" in update_data
        and update_data["class_id"] is not None
    ):
        school_class = (
            db.query(SchoolClass)
            .filter(
                SchoolClass.id == update_data["class_id"],
                SchoolClass.is_active.is_(True),
            )
            .first()
        )

        if not school_class:
            raise HTTPException(
                status_code=400,
                detail="Class not found or inactive",
            )

    for field, value in update_data.items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)

    return student


@router.delete("/{student_id}", response_model=StudentResponse)
def deactivate_student(
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
            detail="Student not found",
        )

    current_status = get_status_value(student.status)

    if current_status != "INACTIVE":
        student.status = "INACTIVE"
        student.status_changed_at = datetime.utcnow()
        student.status_reason = "Student deactivated"

        history_entry = StudentStatusHistory(
            student_id=student.id,
            old_status=current_status,
            new_status="INACTIVE",
            reason="Student deactivated",
            changed_by_user_id=current_user.id,
        )

        db.add(history_entry)

    student.is_active = False

    db.commit()
    db.refresh(student)

    return student