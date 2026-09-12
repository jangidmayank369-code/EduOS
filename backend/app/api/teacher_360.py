from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (
    SectionSubjectTeacher,
    SectionTimetable,
    SchoolClass,
    SchoolSection,
    Teacher,
    TeacherAttendance,
    TeacherDocument,
    TeacherEmploymentProfile,
    TeacherLeave,
    TeacherPayroll,
    TeacherPayment,
    TeacherSalaryStructure,
    TimetablePeriod,
    User,
)
from app.schemas.teacher_360 import (
    Teacher360AttendanceSummary,
    Teacher360BasicProfile,
    Teacher360DocumentSummary,
    Teacher360Employment,
    Teacher360LeaveSummary,
    Teacher360PayrollSummary,
    Teacher360PaymentSummary,
    Teacher360ProfileResponse,
    Teacher360Salary,
    Teacher360Section,
    Teacher360TimetableEntry,
)
from app.api.auth import get_current_user


router = APIRouter(
    prefix="/teachers",
    tags=["Teacher 360"],
)


def _get_teacher(db: Session, teacher_id: int) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )
    return teacher


def _is_self_or_admin(current_user: User, teacher: Teacher) -> bool:
    if teacher.user_id == current_user.id:
        return True
    return str(getattr(current_user, "role", "")).lower() in {"admin", "super_admin"}


def _teacher_name(teacher: Teacher) -> tuple[str, str]:
    return (
        getattr(teacher, "first_name", "") or "",
        getattr(teacher, "last_name", "") or "",
    )


def _build_profile(db: Session, teacher: Teacher) -> Teacher360ProfileResponse:
    first_name, last_name = _teacher_name(teacher)

    basic = Teacher360BasicProfile(
        teacher_id=teacher.id,
        employee_number=getattr(teacher, "employee_number", None),
        first_name=first_name,
        last_name=last_name,
        phone=getattr(teacher, "phone", None),
        email=getattr(teacher, "email", None),
        is_active=bool(getattr(teacher, "is_active", False)),
    )

    employment_row = (
        db.query(TeacherEmploymentProfile)
        .filter(TeacherEmploymentProfile.teacher_id == teacher.id)
        .first()
    )
    employment = None
    if employment_row:
        employment = Teacher360Employment.model_validate(employment_row)

    linked_user = None
    if teacher.user_id:
        linked_user = db.query(User).filter(User.id == teacher.user_id).first()

    assignment_rows = (
        db.query(
            SectionSubjectTeacher,
            SchoolSection,
            SchoolClass,
        )
        .join(SchoolSection, SchoolSection.id == SectionSubjectTeacher.section_id)
        .join(SchoolClass, SchoolClass.id == SchoolSection.class_id)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher.id,
            SectionSubjectTeacher.is_active.is_(True),
            SchoolSection.is_active.is_(True),
            SchoolClass.is_active.is_(True),
        )
        .all()
    )

    sections: list[Teacher360Section] = []
    section_ids: set[int] = set()
    assigned_subject_pairs: set[tuple[int, int]] = set()

    for mapping, section, school_class in assignment_rows:
        section_ids.add(section.id)
        assigned_subject_pairs.add((section.id, mapping.subject_id))
        sections.append(
            Teacher360Section(
                section_id=section.id,
                section_name=section.name,
                class_id=school_class.id,
                class_name=school_class.name,
                subject_id=mapping.subject_id,
                subject_name=getattr(mapping.subject, "name", None),
                subject_code=getattr(mapping.subject, "code", None),
                is_class_teacher=(section.class_teacher_id == teacher.id),
            )
        )

    class_teacher_rows = (
        db.query(SchoolSection, SchoolClass)
        .join(SchoolClass, SchoolClass.id == SchoolSection.class_id)
        .filter(
            SchoolSection.class_teacher_id == teacher.id,
            SchoolSection.is_active.is_(True),
            SchoolClass.is_active.is_(True),
        )
        .all()
    )

    existing_section_ids = {item.section_id for item in sections}
    for section, school_class in class_teacher_rows:
        if section.id not in existing_section_ids:
            sections.append(
                Teacher360Section(
                    section_id=section.id,
                    section_name=section.name,
                    class_id=school_class.id,
                    class_name=school_class.name,
                    is_class_teacher=True,
                )
            )
            section_ids.add(section.id)

    timetable_rows = (
        db.query(
            SectionTimetable,
            SchoolSection,
            TimetablePeriod,
        )
        .join(SchoolSection, SchoolSection.id == SectionTimetable.section_id)
        .join(TimetablePeriod, TimetablePeriod.id == SectionTimetable.period_id)
        .filter(
            SectionTimetable.teacher_id == teacher.id,
            SectionTimetable.is_active.is_(True),
            SchoolSection.is_active.is_(True),
            TimetablePeriod.is_active.is_(True),
        )
        .order_by(
            SectionTimetable.day_of_week,
            TimetablePeriod.period_number,
        )
        .all()
    )

    timetable: list[Teacher360TimetableEntry] = []
    for entry, section, period in timetable_rows:
        timetable.append(
            Teacher360TimetableEntry(
                timetable_id=entry.id,
                section_id=section.id,
                section_name=section.name,
                day_of_week=entry.day_of_week,
                period_id=period.id,
                period_number=period.period_number,
                period_name=period.name,
                start_time=period.start_time,
                end_time=period.end_time,
                is_break=bool(period.is_break),
                subject_id=entry.subject_id,
                subject_name=getattr(entry.subject, "name", None),
                subject_code=getattr(entry.subject, "code", None),
                room_number=entry.room_number,
            )
        )

    attendance_rows = (
        db.query(TeacherAttendance.status)
        .filter(TeacherAttendance.teacher_id == teacher.id)
        .all()
    )
    attendance_counts = {
        "PRESENT": 0,
        "ABSENT": 0,
        "HALF_DAY": 0,
        "ON_LEAVE": 0,
        "HOLIDAY": 0,
        "LATE": 0,
    }
    for (status_value,) in attendance_rows:
        key = str(status_value or "").upper()
        if key in attendance_counts:
            attendance_counts[key] += 1

    attendance_summary = Teacher360AttendanceSummary(
        total_records=len(attendance_rows),
        present=attendance_counts["PRESENT"],
        absent=attendance_counts["ABSENT"],
        half_day=attendance_counts["HALF_DAY"],
        on_leave=attendance_counts["ON_LEAVE"],
        holiday=attendance_counts["HOLIDAY"],
        late=attendance_counts["LATE"],
        other=max(
            0,
            len(attendance_rows) - sum(attendance_counts.values()),
        ),
    )

    leave_rows = (
        db.query(TeacherLeave.status)
        .filter(TeacherLeave.teacher_id == teacher.id)
        .all()
    )
    leave_counts = {
        "PENDING": 0,
        "APPROVED": 0,
        "REJECTED": 0,
        "CANCELLED": 0,
    }
    for (status_value,) in leave_rows:
        key = str(status_value or "").upper()
        if key in leave_counts:
            leave_counts[key] += 1

    leave_summary = Teacher360LeaveSummary(
        total=len(leave_rows),
        pending=leave_counts["PENDING"],
        approved=leave_counts["APPROVED"],
        rejected=leave_counts["REJECTED"],
        cancelled=leave_counts["CANCELLED"],
    )

    current_salary_row = (
        db.query(TeacherSalaryStructure)
        .filter(
            TeacherSalaryStructure.teacher_id == teacher.id,
            TeacherSalaryStructure.is_active.is_(True),
            TeacherSalaryStructure.effective_from <= date.today(),
        )
        .order_by(TeacherSalaryStructure.effective_from.desc())
        .first()
    )
    current_salary = None
    if current_salary_row:
        current_salary = Teacher360Salary(
            salary_structure_id=current_salary_row.id,
            effective_from=current_salary_row.effective_from,
            effective_to=current_salary_row.effective_to,
            basic_salary=current_salary_row.basic_salary,
            allowances=current_salary_row.allowances or {},
            deductions=current_salary_row.deductions or {},
            payroll_type=current_salary_row.payroll_type,
            is_active=current_salary_row.is_active,
        )

    payroll_rows = (
        db.query(TeacherPayroll)
        .filter(TeacherPayroll.teacher_id == teacher.id)
        .order_by(
            TeacherPayroll.payroll_year.desc(),
            TeacherPayroll.payroll_month.desc(),
        )
        .limit(12)
        .all()
    )
    recent_payroll = [
        Teacher360PayrollSummary(
            id=row.id,
            payroll_year=row.payroll_year,
            payroll_month=row.payroll_month,
            gross_salary=row.gross_salary,
            total_deductions=row.total_deductions,
            net_salary=row.net_salary,
            status=row.status,
            processed_at=row.processed_at,
        )
        for row in payroll_rows
    ]

    recent_payments_rows = (
        db.query(TeacherPayment)
        .join(TeacherPayroll, TeacherPayroll.id == TeacherPayment.payroll_id)
        .filter(TeacherPayroll.teacher_id == teacher.id)
        .order_by(TeacherPayment.payment_date.desc(), TeacherPayment.id.desc())
        .limit(12)
        .all()
    )
    recent_payments = [
        Teacher360PaymentSummary(
            id=row.id,
            payroll_id=row.payroll_id,
            payment_date=row.payment_date,
            amount=row.amount,
            payment_method=row.payment_method,
            transaction_reference=row.transaction_reference,
            status=row.status,
        )
        for row in recent_payments_rows
    ]

    document_rows = (
        db.query(TeacherDocument)
        .filter(
            TeacherDocument.teacher_id == teacher.id,
            TeacherDocument.is_active.is_(True),
        )
        .order_by(TeacherDocument.created_at.desc())
        .all()
    )
    documents = [
        Teacher360DocumentSummary(
            id=row.id,
            document_type=row.document_type,
            document_name=row.document_name,
            document_number=row.document_number,
            issue_date=row.issue_date,
            expiry_date=row.expiry_date,
            file_url=row.file_url,
            file_name=row.file_name,
            mime_type=row.mime_type,
            is_verified=row.is_verified,
            verified_at=row.verified_at,
            is_active=row.is_active,
        )
        for row in document_rows
    ]

    return Teacher360ProfileResponse(
        basic_profile=basic,
        employment=employment,
        account_linked=linked_user is not None,
        account_active=linked_user.is_active if linked_user else None,
        sections=sections,
        timetable=timetable,
        total_subject_assignments=len(assigned_subject_pairs),
        total_sections=len(section_ids),
        class_teacher_sections=sum(
            1 for section in sections if section.is_class_teacher
        ),
        weekly_timetable_periods=len(timetable),
        attendance_summary=attendance_summary,
        leave_summary=leave_summary,
        current_salary=current_salary,
        recent_payroll=recent_payroll,
        recent_payments=recent_payments,
        documents=documents,
    )

@router.get(
    "/me/360-profile",
    response_model=Teacher360ProfileResponse,
)
def get_my_teacher_360_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = (
        db.query(Teacher)
        .filter(Teacher.user_id == current_user.id)
        .first()
    )
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile is not linked to this account",
        )
    return _build_profile(db, teacher)

@router.get(
    "/{teacher_id}/360-profile",
    response_model=Teacher360ProfileResponse,
)
def get_teacher_360_profile(
    teacher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher(db, teacher_id)
    if not _is_self_or_admin(current_user, teacher):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this teacher profile",
        )
    return _build_profile(db, teacher)
