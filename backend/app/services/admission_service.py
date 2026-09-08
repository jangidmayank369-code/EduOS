from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.admission_application import AdmissionApplication
from app.models.student import Student
from app.models.student_enrollment import StudentEnrollment
from app.models.user import User
from app.services.parent_service import link_parent_to_student


def convert_admission_to_student(
    db: Session,
    application_id: int,
    current_user: User,
) -> tuple[Student, str | None]:
    application = (
        db.query(AdmissionApplication)
        .filter(
            AdmissionApplication.id == application_id
        )
        .first()
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Admission application not found",
        )

    if application.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only an approved admission can be "
                "converted into a student."
            ),
        )

    if application.student_id is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                "This admission has already been "
                "converted into a student."
            ),
        )

    if application.applying_class_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "A class must be selected before "
                "admission can be completed."
            ),
        )

    try:
        # ---------------------------------------------------------
        # 1. Admission number
        # ---------------------------------------------------------
        admission_number = application.application_number

        existing_student = (
            db.query(Student)
            .filter(
                Student.admission_number == admission_number
            )
            .first()
        )

        if existing_student:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Admission number "
                    f"'{admission_number}' is already "
                    "assigned to another student."
                ),
            )

        # ---------------------------------------------------------
        # 2. Create Student
        # ---------------------------------------------------------
        student = Student(
            admission_number=admission_number,
            first_name=application.first_name,
            last_name=application.last_name,
            date_of_birth=application.date_of_birth,
            gender=application.gender,
            email=application.email,
            phone=application.phone,
            address=application.address,
            class_id=application.applying_class_id,
            is_active=True,
            status="ACTIVE",
            status_changed_at=datetime.utcnow(),
            status_reason="Created from approved admission",
        )

        db.add(student)
        db.flush()

        # ---------------------------------------------------------
        # 3. Create Enrollment
        # ---------------------------------------------------------
        existing_enrollment = (
            db.query(StudentEnrollment)
            .filter(
                StudentEnrollment.student_id == student.id,
                StudentEnrollment.academic_session_id
                == application.academic_session_id,
            )
            .first()
        )

        if existing_enrollment:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Student is already enrolled in "
                    "this academic session."
                ),
            )

        enrollment = StudentEnrollment(
            student_id=student.id,
            academic_session_id=application.academic_session_id,
            class_id=application.applying_class_id,
            admission_application_id=application.id,
            enrollment_date=datetime.utcnow().date(),
            status="ACTIVE",
            remarks="Created from approved admission",
        )

        db.add(enrollment)
        db.flush()

        # ---------------------------------------------------------
        # 4. Create / reuse Parent and link to Student
        #
        # New parent accounts receive an invitation token.
        # Existing parent accounts do not get a new token here.
        # ---------------------------------------------------------
        _, invitation_token = link_parent_to_student(
            db=db,
            student=student,
            parent_first_name=application.parent_first_name,
            parent_last_name=application.parent_last_name,
            parent_phone=application.parent_phone,
            parent_email=application.parent_email,
            parent_relation=application.parent_relation,
        )

        # ---------------------------------------------------------
        # 5. Link Admission → Student
        # ---------------------------------------------------------
        application.student_id = student.id
        application.status = "ADMITTED"
        application.reviewed_by_user_id = current_user.id
        application.reviewed_at = datetime.utcnow()

        db.add(application)

        # ---------------------------------------------------------
        # 6. Commit complete workflow
        # ---------------------------------------------------------
        db.commit()
        db.refresh(student)

        return student, invitation_token

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Admission conversion failed: {str(exc)}",
        ) from exc