from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.parent import Parent
from app.models.parent_child import ParentChild
from app.models.student import Student
from app.models.user import User
from app.services.parent_invitation_service import (
    create_parent_invitation,
)


def link_parent_to_student(
    db: Session,
    student: Student,
    parent_first_name: str | None,
    parent_last_name: str | None,
    parent_phone: str | None,
    parent_email: str | None,
    parent_relation: str | None,
) -> tuple[Parent | None, str | None]:
    """
    Create/link a parent profile with a student.

    Returns:
        (parent, invitation_token)

    The invitation token is only returned when a new parent
    account needs to be activated or when an existing parent
    account needs a fresh invitation.
    """

    if not parent_email and not parent_phone:
        return None, None

    # ---------------------------------------------------------
    # 1. Find existing user by email
    # ---------------------------------------------------------
    parent_user = None

    if parent_email:
        parent_user = (
            db.query(User)
            .filter(User.email == parent_email)
            .first()
        )

    # ---------------------------------------------------------
    # 2. Create parent user when email is available
    # ---------------------------------------------------------
    invitation_token: str | None = None

    if parent_user is None:
        if not parent_email:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Parent email is required to automatically "
                    "create a parent account."
                ),
            )

        # Generate a random unusable password.
        #
        # The parent will set the real password through the
        # invitation flow.
        from app.core.security import hash_password
        import secrets

        unusable_password = secrets.token_urlsafe(32)

        parent_user = User(
            email=parent_email,
            password_hash=hash_password(unusable_password),
            role="parent",
            is_active=False,
        )

        db.add(parent_user)
        db.flush()

        invitation_token = create_parent_invitation(
            db=db,
            user=parent_user,
        )

    # ---------------------------------------------------------
    # 3. Existing user must be a parent account
    # ---------------------------------------------------------
    if parent_user.role != "parent":
        raise HTTPException(
            status_code=400,
            detail=(
                "The email provided for the parent is already "
                "associated with a non-parent account."
            ),
        )

    # ---------------------------------------------------------
    # 4. Find or create Parent profile
    # ---------------------------------------------------------
    parent = (
        db.query(Parent)
        .filter(
            Parent.user_id == parent_user.id
        )
        .first()
    )

    if parent is None:
        parent = Parent(
            user_id=parent_user.id,
            first_name=parent_first_name or "Parent",
            last_name=parent_last_name or "",
            phone=parent_phone,
            is_active=True,
        )

        db.add(parent)
        db.flush()

    else:
        if parent_phone and not parent.phone:
            parent.phone = parent_phone

        if (
            parent_first_name
            and parent.first_name == "Parent"
        ):
            parent.first_name = parent_first_name

        if (
            parent_last_name
            and not parent.last_name
        ):
            parent.last_name = parent_last_name

    # ---------------------------------------------------------
    # 5. Prevent duplicate Parent ↔ Student relationship
    # ---------------------------------------------------------
    existing_link = (
        db.query(ParentChild)
        .filter(
            ParentChild.parent_id == parent.id,
            ParentChild.student_id == student.id,
        )
        .first()
    )

    if existing_link is None:
        parent_child = ParentChild(
            parent_id=parent.id,
            student_id=student.id,
            relation_type=(
                parent_relation or "GUARDIAN"
            ),
            is_primary=True,
            is_emergency_contact=True,
            receives_notifications=True,
        )

        db.add(parent_child)

    return parent, invitation_token