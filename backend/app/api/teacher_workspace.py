from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models import (
    Parent,
    ParentChild,
    SchoolClass,
    SchoolSection,
    SectionSubjectTeacher,
    Student,
    Subject,
    Teacher,
    User,
)
from app.schemas.teacher_workspace import (
    TeacherWorkspaceParent,
    TeacherWorkspaceResponse,
    TeacherWorkspaceSection,
    TeacherWorkspaceStudent,
    TeacherWorkspaceSubject,
    TeacherWorkspaceTeacher,
)

router = APIRouter(
    prefix="/teacher",
    tags=["Teacher Workspace"],
)


def _get_teacher_for_user(
    db: Session,
    current_user: User,
) -> Teacher:
    teacher = (
        db.query(Teacher)
        .filter(
            Teacher.user_id == current_user.id,
            Teacher.is_active.is_(True),
        )
        .first()
    )

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active teacher profile is not linked to this account",
        )

    return teacher


def _student_status_value(value) -> str:
    return str(getattr(value, "value", value or "")).upper()


@router.get(
    "/me/workspace",
    response_model=TeacherWorkspaceResponse,
)
def get_my_teacher_workspace(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = _get_teacher_for_user(db, current_user)

    # ------------------------------------------------------------
    # Academic ownership:
    #   1. sections where this teacher is assigned a subject
    #   2. sections where this teacher is the class teacher
    # ------------------------------------------------------------
    subject_mappings = (
        db.query(SectionSubjectTeacher)
        .filter(
            SectionSubjectTeacher.teacher_id == teacher.id,
            SectionSubjectTeacher.is_active.is_(True),
        )
        .all()
    )

    class_teacher_sections = (
        db.query(SchoolSection)
        .filter(
            SchoolSection.class_teacher_id == teacher.id,
            SchoolSection.is_active.is_(True),
        )
        .all()
    )

    section_ids = {
        mapping.section_id
        for mapping in subject_mappings
    }
    section_ids.update(
        section.id for section in class_teacher_sections
    )

    sections_by_id: dict[int, SchoolSection] = {}

    if section_ids:
        section_rows = (
            db.query(SchoolSection)
            .filter(
                SchoolSection.id.in_(section_ids),
                SchoolSection.is_active.is_(True),
            )
            .all()
        )
        sections_by_id = {
            section.id: section
            for section in section_rows
        }

    class_ids = {
        section.class_id
        for section in sections_by_id.values()
    }

    classes_by_id: dict[int, SchoolClass] = {}
    if class_ids:
        class_rows = (
            db.query(SchoolClass)
            .filter(
                SchoolClass.id.in_(class_ids),
                SchoolClass.is_active.is_(True),
            )
            .all()
        )
        classes_by_id = {
            school_class.id: school_class
            for school_class in class_rows
        }

    subject_ids = {
        mapping.subject_id
        for mapping in subject_mappings
    }

    subjects_by_id: dict[int, Subject] = {}
    if subject_ids:
        subject_rows = (
            db.query(Subject)
            .filter(
                Subject.id.in_(subject_ids),
                Subject.is_active.is_(True),
            )
            .all()
        )
        subjects_by_id = {
            subject.id: subject
            for subject in subject_rows
        }

    # ------------------------------------------------------------
    # Students are restricted by section ownership.
    # A subject teacher sees students in assigned sections.
    # A class teacher sees all students in their class section.
    # ------------------------------------------------------------
    students_by_section: dict[int, list[Student]] = {
        section_id: []
        for section_id in sections_by_id
    }

    if section_ids:
        student_rows = (
            db.query(Student)
            .filter(
                Student.section_id.in_(section_ids),
                Student.is_active.is_(True),
            )
            .order_by(
                Student.section_id.asc(),
                Student.first_name.asc(),
                Student.last_name.asc(),
                Student.id.asc(),
            )
            .all()
        )

        for student in student_rows:
            if student.section_id in students_by_section:
                students_by_section[student.section_id].append(student)

    # ------------------------------------------------------------
    # Parent contact data for the same teacher-visible students.
    # ------------------------------------------------------------
    all_student_ids = [
        student.id
        for students in students_by_section.values()
        for student in students
    ]

    parent_links_by_student: dict[int, list[ParentChild]] = {
        student_id: []
        for student_id in all_student_ids
    }

    parents_by_id: dict[int, Parent] = {}

    if all_student_ids:
        parent_links = (
            db.query(ParentChild)
            .filter(
                ParentChild.student_id.in_(all_student_ids)
            )
            .all()
        )

        parent_ids = {
            link.parent_id
            for link in parent_links
        }

        if parent_ids:
            parent_rows = (
                db.query(Parent)
                .filter(
                    Parent.id.in_(parent_ids),
                    Parent.is_active.is_(True),
                )
                .all()
            )
            parents_by_id = {
                parent.id: parent
                for parent in parent_rows
            }

        for link in parent_links:
            if (
                link.student_id in parent_links_by_student
                and link.parent_id in parents_by_id
            ):
                parent_links_by_student[
                    link.student_id
                ].append(link)

    # ------------------------------------------------------------
    # Section-wise subject assignments.
    # ------------------------------------------------------------
    mappings_by_section: dict[int, list[SectionSubjectTeacher]] = {
        section_id: []
        for section_id in sections_by_id
    }

    for mapping in subject_mappings:
        if mapping.section_id in mappings_by_section:
            mappings_by_section[
                mapping.section_id
            ].append(mapping)

    response_sections: list[TeacherWorkspaceSection] = []

    for section_id, section in sorted(
        sections_by_id.items(),
        key=lambda item: (
            classes_by_id.get(item[1].class_id).name.lower()
            if classes_by_id.get(item[1].class_id)
            else "",
            item[1].name.lower(),
            item[0],
        ),
    ):
        school_class = classes_by_id.get(section.class_id)

        section_subjects: list[TeacherWorkspaceSubject] = []
        seen_subject_ids: set[int] = set()

        for mapping in mappings_by_section.get(section_id, []):
            subject = subjects_by_id.get(mapping.subject_id)
            if not subject or subject.id in seen_subject_ids:
                continue

            seen_subject_ids.add(subject.id)

            section_subjects.append(
                TeacherWorkspaceSubject(
                    id=subject.id,
                    name=subject.name,
                    code=subject.code,
                    section_id=section.id,
                )
            )

        section_students: list[TeacherWorkspaceStudent] = []

        for student in students_by_section.get(section_id, []):
            parent_items: list[TeacherWorkspaceParent] = []

            for link in parent_links_by_student.get(student.id, []):
                parent = parents_by_id.get(link.parent_id)
                if not parent:
                    continue

                parent_items.append(
                    TeacherWorkspaceParent(
                        parent_id=parent.id,
                        first_name=parent.first_name,
                        last_name=parent.last_name,
                        phone=parent.phone,
                        relation_type=link.relation_type,
                        is_primary=bool(link.is_primary),
                        is_emergency_contact=bool(
                            link.is_emergency_contact
                        ),
                        receives_notifications=bool(
                            link.receives_notifications
                        ),
                    )
                )

            section_students.append(
                TeacherWorkspaceStudent(
                    id=student.id,
                    admission_number=student.admission_number,
                    first_name=student.first_name,
                    last_name=student.last_name,
                    class_id=student.class_id,
                    section_id=student.section_id,
                    phone=student.phone,
                    is_active=bool(student.is_active),
                    status=_student_status_value(student.status),
                    parents=parent_items,
                )
            )

        response_sections.append(
            TeacherWorkspaceSection(
                id=section.id,
                class_id=section.class_id,
                class_name=(
                    school_class.name
                    if school_class
                    else f"Class #{section.class_id}"
                ),
                name=section.name,
                class_teacher_id=section.class_teacher_id,
                is_class_teacher=(
                    section.class_teacher_id == teacher.id
                ),
                subjects=section_subjects,
                students=section_students,
            )
        )

    total_students = sum(
        len(section.students)
        for section in response_sections
    )

    total_subject_assignments = sum(
        len(section.subjects)
        for section in response_sections
    )

    class_teacher_sections = sum(
        1
        for section in response_sections
        if section.is_class_teacher
    )

    return TeacherWorkspaceResponse(
        teacher=TeacherWorkspaceTeacher(
            id=teacher.id,
            employee_number=teacher.employee_number,
            first_name=teacher.first_name,
            last_name=teacher.last_name,
            phone=teacher.phone,
            email=teacher.email,
        ),
        sections=response_sections,
        total_sections=len(response_sections),
        total_students=total_students,
        total_subject_assignments=total_subject_assignments,
        class_teacher_sections=class_teacher_sections,
    )
