from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import require_role
from app.models.user import User
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.section_subject_teacher import SectionSubjectTeacher
from app.models.exam import Exam
from app.models.exam_subject import ExamSubject
from app.models.mark import Mark
from app.schemas.mark import (
    MarkCreate,
    MarkUpdate,
    MarkResponse,
    MarkBulkCreate,
    MarkBulkResponse,
)


router = APIRouter(
    prefix="/marks",
    tags=["Marks"],
)


VALID_EDITABLE_EXAM_STATUSES = {
    "DRAFT",
    "ACTIVE",
}


# -------------------------------------------------------------------
# HELPERS
# -------------------------------------------------------------------


def calculate_percentage(
    marks_obtained: float,
    max_marks: float,
) -> float:
    if max_marks <= 0:
        return 0.0

    return round(
        (marks_obtained / max_marks) * 100,
        2,
    )


def calculate_grade(percentage: float) -> str:
    if percentage >= 90:
        return "A+"

    if percentage >= 80:
        return "A"

    if percentage >= 70:
        return "B+"

    if percentage >= 60:
        return "B"

    if percentage >= 50:
        return "C"

    if percentage >= 40:
        return "D"

    return "F"


def build_mark_response(mark: Mark) -> MarkResponse:
    percentage = calculate_percentage(
        mark.marks_obtained,
        mark.max_marks,
    )

    return MarkResponse(
        id=mark.id,
        student_id=mark.student_id,
        exam_id=mark.exam_id,
        subject_id=mark.subject_id,
        marks_obtained=mark.marks_obtained,
        max_marks=mark.max_marks,
        entered_by=mark.entered_by,
        created_at=mark.created_at,
        updated_at=mark.updated_at,
        percentage=percentage,
        grade=calculate_grade(percentage),
    )


def get_exam_for_edit(
    db: Session,
    exam_id: int,
) -> Exam:
    exam = (
        db.query(Exam)
        .filter(Exam.id == exam_id)
        .first()
    )

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam not found",
        )

    if exam.status not in VALID_EDITABLE_EXAM_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Marks cannot be edited when exam status is "
                f"{exam.status}"
            ),
        )

    return exam


def validate_mark_values(
    marks_obtained: float,
    max_marks: float,
) -> None:
    if max_marks <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_marks must be greater than 0",
        )

    if marks_obtained < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="marks_obtained cannot be negative",
        )

    if marks_obtained > max_marks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="marks_obtained cannot be greater than max_marks",
        )


def get_teacher_profile(
    db: Session,
    current_user: User,
) -> Teacher | None:
    """
    Admin does not need a Teacher profile.

    Teacher users must have a valid Teacher profile.
    """

    if current_user.role == "admin":
        return None

    teacher = (
        db.query(Teacher)
        .filter(Teacher.user_id == current_user.id)
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher profile not found",
        )

    return teacher


def validate_teacher_assignment(
    db: Session,
    teacher: Teacher | None,
    student: Student,
    subject_id: int,
) -> None:
    """
    Admin can enter marks for any student/subject.

    Teacher can enter marks only when the student belongs to a section
    where that teacher is actively assigned to the selected subject.
    The section-level assignment is authoritative; the legacy
    class-level TeacherAssignment table is intentionally not used here.
    """

    if teacher is None:
        return

    if student.section_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student is not assigned to a section",
        )

    assignment = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher.id,
            SectionSubjectTeacher.section_id == student.section_id,
            SectionSubjectTeacher.subject_id == subject_id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You are not assigned to this student's section "
                "and subject"
            ),
        )


def get_exam_subject_config(
    db: Session,
    exam_id: int,
    class_id: int,
    subject_id: int,
) -> ExamSubject:
    config = (
        db.query(ExamSubject)
        .filter(
            ExamSubject.exam_id == exam_id,
            ExamSubject.class_id == class_id,
            ExamSubject.subject_id == subject_id,
        )
        .first()
    )

    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This subject is not configured for the selected "
                "exam and class"
            ),
        )

    return config


def validate_max_marks(
    payload_max_marks: float,
    config: ExamSubject,
) -> None:
    if payload_max_marks != config.max_marks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"max_marks must be {config.max_marks} "
                f"for this exam subject"
            ),
        )


# -------------------------------------------------------------------
# CREATE SINGLE MARK
# ADMIN + TEACHER
# -------------------------------------------------------------------


@router.post(
    "/",
    response_model=MarkResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_mark(
    payload: MarkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "teacher")
    ),
):
    teacher = get_teacher_profile(
        db,
        current_user,
    )

    get_exam_for_edit(
        db,
        payload.exam_id,
    )

    student = (
        db.query(Student)
        .filter(Student.id == payload.student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    config = get_exam_subject_config(
        db,
        payload.exam_id,
        student.class_id,
        payload.subject_id,
    )

    validate_teacher_assignment(
        db,
        teacher,
        student,
        payload.subject_id,
    )

    validate_mark_values(
        payload.marks_obtained,
        payload.max_marks,
    )

    validate_max_marks(
        payload.max_marks,
        config,
    )

    existing = (
        db.query(Mark)
        .filter(
            Mark.student_id == payload.student_id,
            Mark.exam_id == payload.exam_id,
            Mark.subject_id == payload.subject_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Marks already exist for this student, "
                "exam and subject. Use update instead."
            ),
        )

    mark = Mark(
        student_id=payload.student_id,
        exam_id=payload.exam_id,
        subject_id=payload.subject_id,
        marks_obtained=payload.marks_obtained,
        max_marks=payload.max_marks,
        entered_by=current_user.id,
    )

    try:
        db.add(mark)
        db.commit()
        db.refresh(mark)

    except Exception:
        db.rollback()
        raise

    return build_mark_response(mark)


# -------------------------------------------------------------------
# BULK SAVE / UPSERT MARKS
# ADMIN + TEACHER
# -------------------------------------------------------------------


@router.post(
    "/bulk",
    response_model=MarkBulkResponse,
)
def bulk_save_marks(
    payload: MarkBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "teacher")
    ),
):
    """
    Save marks for an entire class/subject in one transaction.

    Existing marks are updated.
    Missing marks are created.

    Unique key:
        student_id + exam_id + subject_id

    ADMIN:
        Can save marks for any class/subject.

    TEACHER:
        Can save marks only for assigned class + subject.
    """

    teacher = get_teacher_profile(
        db,
        current_user,
    )

    get_exam_for_edit(
        db,
        payload.exam_id,
    )

    # ---------------------------------------------------------------
    # Prevent duplicate student IDs in the same request.
    # ---------------------------------------------------------------

    student_ids = [
        item.student_id
        for item in payload.items
    ]

    if len(student_ids) != len(set(student_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate student_id found in bulk request",
        )

    # ---------------------------------------------------------------
    # Load all students in one query.
    # ---------------------------------------------------------------

    students = (
        db.query(Student)
        .filter(Student.id.in_(student_ids))
        .all()
    )

    students_by_id = {
        student.id: student
        for student in students
    }

    missing_student_ids = [
        student_id
        for student_id in student_ids
        if student_id not in students_by_id
    ]

    if missing_student_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Student(s) not found: "
                + ", ".join(
                    str(student_id)
                    for student_id in missing_student_ids
                )
            ),
        )

    # ---------------------------------------------------------------
    # Validate EVERYTHING before changing database.
    # ---------------------------------------------------------------

    for item in payload.items:
        student = students_by_id[item.student_id]

        config = get_exam_subject_config(
            db,
            payload.exam_id,
            student.class_id,
            payload.subject_id,
        )

        validate_teacher_assignment(
            db,
            teacher,
            student,
            payload.subject_id,
        )

        validate_mark_values(
            item.marks_obtained,
            item.max_marks,
        )

        validate_max_marks(
            item.max_marks,
            config,
        )

    # ---------------------------------------------------------------
    # Load existing marks in one query.
    # ---------------------------------------------------------------

    existing_marks = (
        db.query(Mark)
        .filter(
            Mark.exam_id == payload.exam_id,
            Mark.subject_id == payload.subject_id,
            Mark.student_id.in_(student_ids),
        )
        .all()
    )

    existing_by_student = {
        mark.student_id: mark
        for mark in existing_marks
    }

    saved_marks: list[Mark] = []

    # ---------------------------------------------------------------
    # Save all marks in one transaction.
    # ---------------------------------------------------------------

    try:
        for item in payload.items:
            existing = existing_by_student.get(
                item.student_id
            )

            if existing:
                existing.marks_obtained = (
                    item.marks_obtained
                )

                existing.max_marks = (
                    item.max_marks
                )

                existing.entered_by = (
                    current_user.id
                )

                saved_marks.append(existing)

            else:
                mark = Mark(
                    student_id=item.student_id,
                    exam_id=payload.exam_id,
                    subject_id=payload.subject_id,
                    marks_obtained=item.marks_obtained,
                    max_marks=item.max_marks,
                    entered_by=current_user.id,
                )

                db.add(mark)
                saved_marks.append(mark)

        db.commit()

        for mark in saved_marks:
            db.refresh(mark)

    except Exception:
        db.rollback()

        # Keep the real database exception visible in backend logs.
        # FastAPI will return the proper server error.
        raise

    return MarkBulkResponse(
        exam_id=payload.exam_id,
        subject_id=payload.subject_id,
        saved_count=len(saved_marks),
        marks=[
            build_mark_response(mark)
            for mark in saved_marks
        ],
    )


# -------------------------------------------------------------------
# GET STUDENT MARKS
# ADMIN + TEACHER
# -------------------------------------------------------------------


@router.get(
    "/student/{student_id}",
    response_model=list[MarkResponse],
)
def get_student_marks(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "teacher")
    ),
):
    teacher = get_teacher_profile(
        db,
        current_user,
    )

    student = (
        db.query(Student)
        .filter(Student.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    # ---------------------------------------------------------------
    # ADMIN can see all marks for this student.
    # ---------------------------------------------------------------

    if teacher is None:
        marks = (
            db.query(Mark)
            .filter(
                Mark.student_id == student_id,
            )
            .all()
        )

        return [
            build_mark_response(mark)
            for mark in marks
        ]

    # ---------------------------------------------------------------
    # TEACHER can see marks only for assigned subjects.
    # ---------------------------------------------------------------

    if student.section_id is None:
        return []

    assignments = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher.id,
            SectionSubjectTeacher.section_id == student.section_id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .all()
    )

    assigned_subject_ids = {
        assignment.subject_id
        for assignment in assignments
    }

    if not assigned_subject_ids:
        return []

    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student_id,
            Mark.subject_id.in_(assigned_subject_ids),
        )
        .all()
    )

    return [
        build_mark_response(mark)
        for mark in marks
    ]


# -------------------------------------------------------------------
# UPDATE SINGLE MARK
# ADMIN + TEACHER
# -------------------------------------------------------------------


@router.put(
    "/{mark_id}",
    response_model=MarkResponse,
)
def update_mark(
    mark_id: int,
    payload: MarkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "teacher")
    ),
):
    teacher = get_teacher_profile(
        db,
        current_user,
    )

    mark = (
        db.query(Mark)
        .filter(Mark.id == mark_id)
        .first()
    )

    if not mark:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mark not found",
        )

    get_exam_for_edit(
        db,
        mark.exam_id,
    )

    student = (
        db.query(Student)
        .filter(Student.id == mark.student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    validate_teacher_assignment(
        db,
        teacher,
        student,
        mark.subject_id,
    )

    config = get_exam_subject_config(
        db,
        mark.exam_id,
        student.class_id,
        mark.subject_id,
    )

    new_marks = (
        payload.marks_obtained
        if payload.marks_obtained is not None
        else mark.marks_obtained
    )

    new_max_marks = (
        payload.max_marks
        if payload.max_marks is not None
        else mark.max_marks
    )

    validate_mark_values(
        new_marks,
        new_max_marks,
    )

    validate_max_marks(
        new_max_marks,
        config,
    )

    mark.marks_obtained = new_marks
    mark.max_marks = new_max_marks
    mark.entered_by = current_user.id

    try:
        db.commit()
        db.refresh(mark)

    except Exception:
        db.rollback()
        raise

    return build_mark_response(mark)


# -------------------------------------------------------------------
# STUDENT - MY MARKS
# -------------------------------------------------------------------


@router.get(
    "/me",
    response_model=list[MarkResponse],
)
def get_my_marks(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("student")
    ),
):
    student = (
        db.query(Student)
        .filter(
            Student.email == current_user.email
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found",
        )

    marks = (
        db.query(Mark)
        .filter(
            Mark.student_id == student.id,
        )
        .all()
    )

    return [
        build_mark_response(mark)
        for mark in marks
    ]
# -------------------------------------------------------------------
# ASSESSMENT COMPONENT MARKS
# -------------------------------------------------------------------

from fastapi import Query
from app.models.mark_component import MarkComponent
from app.schemas.mark import MarkComponentBulkCreate, MarkComponentResponse, MarkComponentsResponse


def _component_percentage(marks_obtained: float | None, max_marks: float) -> float | None:
    if marks_obtained is None or max_marks <= 0:
        return None
    return round((marks_obtained / max_marks) * 100, 2)


def _component_response(component: MarkComponent) -> MarkComponentResponse:
    percentage = _component_percentage(component.marks_obtained, float(component.max_marks))
    is_pass = None if component.marks_obtained is None else float(component.marks_obtained) >= float(component.pass_marks)
    return MarkComponentResponse(
        id=component.id,
        mark_id=component.mark_id,
        component_key=component.component_key,
        component_name=component.component_name,
        component_type=component.component_type,
        marks_obtained=component.marks_obtained,
        max_marks=component.max_marks,
        pass_marks=component.pass_marks,
        percentage=percentage,
        grade=calculate_grade(percentage) if percentage is not None else None,
        is_pass=is_pass,
        entered_by=component.entered_by,
        created_at=component.created_at,
        updated_at=component.updated_at,
    )


def _validate_component_against_exam_subject(config: ExamSubject, component_key: str, component_type: str, max_marks: float, pass_marks: float) -> None:
    configured = getattr(config, "components", None) or []
    if not configured:
        return
    match = None
    for item in configured:
        key = item.get("key") if isinstance(item, dict) else getattr(item, "key", None)
        if key is not None and str(key).strip().lower() == component_key.strip().lower():
            match = item
            break
    if match is None:
        raise HTTPException(status_code=400, detail=f"Assessment component '{component_key}' is not configured for this exam subject")
    getv = lambda name, default=0: match.get(name, default) if isinstance(match, dict) else getattr(match, name, default)
    configured_max = float(getv("max_marks", 0))
    configured_pass = float(getv("pass_marks", 0))
    configured_type = str(getv("type", "OTHER")).upper()
    if abs(configured_max - float(max_marks)) > 0.001:
        raise HTTPException(status_code=400, detail=f"max_marks must be {configured_max} for component '{component_key}'")
    if abs(configured_pass - float(pass_marks)) > 0.001:
        raise HTTPException(status_code=400, detail=f"pass_marks must be {configured_pass} for component '{component_key}'")
    if configured_type != component_type.upper():
        raise HTTPException(status_code=400, detail=f"component_type must be {configured_type} for component '{component_key}'")


@router.get("/components/student/{student_id}", response_model=MarkComponentsResponse)
def get_student_mark_components(student_id: int, exam_id: int = Query(...), subject_id: int = Query(...), db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "teacher"))):
    teacher = get_teacher_profile(db, current_user)
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    validate_teacher_assignment(db, teacher, student, subject_id)
    mark = db.query(Mark).filter(Mark.student_id == student_id, Mark.exam_id == exam_id, Mark.subject_id == subject_id).first()
    if mark is None:
        return MarkComponentsResponse(exam_id=exam_id, subject_id=subject_id, student_id=student_id, components=[])
    components = db.query(MarkComponent).filter(MarkComponent.mark_id == mark.id).order_by(MarkComponent.id.asc()).all()
    return MarkComponentsResponse(exam_id=exam_id, subject_id=subject_id, student_id=student_id, components=[_component_response(item) for item in components])


@router.post("/components/bulk", response_model=list[MarkComponentResponse])
def bulk_save_mark_components(payload: MarkComponentBulkCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin", "teacher"))):
    teacher = get_teacher_profile(db, current_user)
    get_exam_for_edit(db, payload.exam_id)
    student_ids = [item.student_id for item in payload.items]
    if len(student_ids) != len(set(student_ids)):
        raise HTTPException(status_code=400, detail="Duplicate student_id found in component bulk request")
    students = db.query(Student).filter(Student.id.in_(student_ids)).all()
    students_by_id = {student.id: student for student in students}
    missing = [sid for sid in student_ids if sid not in students_by_id]
    if missing:
        raise HTTPException(status_code=404, detail="Student(s) not found: " + ", ".join(map(str, missing)))

    component_key = payload.component_key.strip()
    component_type = payload.component_type.strip().upper()
    for item in payload.items:
        student = students_by_id[item.student_id]
        config = get_exam_subject_config(db, payload.exam_id, student.class_id, payload.subject_id)
        validate_teacher_assignment(db, teacher, student, payload.subject_id)
        if item.marks_obtained is not None and item.marks_obtained > payload.max_marks:
            raise HTTPException(status_code=400, detail="marks_obtained cannot be greater than component max_marks")
        _validate_component_against_exam_subject(config, component_key, component_type, payload.max_marks, payload.pass_marks)

    saved: list[MarkComponent] = []
    try:
        for item in payload.items:
            mark = db.query(Mark).filter(Mark.student_id == item.student_id, Mark.exam_id == payload.exam_id, Mark.subject_id == payload.subject_id).first()
            if mark is None:
                mark = Mark(student_id=item.student_id, exam_id=payload.exam_id, subject_id=payload.subject_id, marks_obtained=0, max_marks=payload.max_marks, entered_by=current_user.id)
                db.add(mark)
                db.flush()
            component = db.query(MarkComponent).filter(MarkComponent.mark_id == mark.id, MarkComponent.component_key == component_key).first()
            if component is None:
                component = MarkComponent(mark_id=mark.id, component_key=component_key, component_name=payload.component_name.strip(), component_type=component_type, marks_obtained=item.marks_obtained, max_marks=payload.max_marks, pass_marks=payload.pass_marks, entered_by=current_user.id)
                db.add(component)
            else:
                component.component_name = payload.component_name.strip()
                component.component_type = component_type
                component.marks_obtained = item.marks_obtained
                component.max_marks = payload.max_marks
                component.pass_marks = payload.pass_marks
                component.entered_by = current_user.id
            db.flush()
            all_components = db.query(MarkComponent).filter(MarkComponent.mark_id == mark.id).all()
            mark.max_marks = sum(float(row.max_marks) for row in all_components)
            mark.marks_obtained = sum(float(row.marks_obtained) for row in all_components if row.marks_obtained is not None)
            mark.entered_by = current_user.id
            saved.append(component)
        db.commit()
        for item in saved:
            db.refresh(item)
    except Exception:
        db.rollback()
        raise
    return [_component_response(item) for item in saved]
