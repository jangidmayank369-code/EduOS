from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.security import hash_password
from app.models.parent import Parent
from app.models.parent_invitation import ParentInvitation
from app.models.user import User
from app.schemas.parent_invitation import (
    ParentInvitationAcceptRequest,
    ParentInvitationAcceptResponse,
    ParentInvitationResponse,
    ParentInvitationValidateResponse,
)
from app.services.parent_invitation_service import (
    create_parent_invitation,
    get_valid_parent_invitation,
    mark_invitation_used,
)

router = APIRouter(
    prefix="/parent-invitations",
    tags=["Parent Invitations"],
)


@router.post(
    "/parent/{parent_id}",
    response_model=ParentInvitationResponse,
)
def create_invitation(
    parent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    parent = (
        db.query(Parent)
        .filter(Parent.id == parent_id)
        .first()
    )

    if not parent:
        raise HTTPException(
            status_code=404,
            detail="Parent not found",
        )

    if not parent.is_active:
        raise HTTPException(
            status_code=400,
            detail="Parent account is inactive",
        )

    user = (
        db.query(User)
        .filter(User.id == parent.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Parent user account not found",
        )

    if user.role != "parent":
        raise HTTPException(
            status_code=400,
            detail="The selected user is not a parent account",
        )

    token = create_parent_invitation(
        db=db,
        user=user,
    )

    db.commit()

    return {
        "message": "Parent invitation created successfully",
        "invitation_token": token,
    }


@router.get(
    "/validate/{token}",
    response_model=ParentInvitationValidateResponse,
)
def validate_invitation(
    token: str,
    db: Session = Depends(get_db),
):
    invitation = get_valid_parent_invitation(
        db=db,
        raw_token=token,
    )

    user = (
        db.query(User)
        .filter(User.id == invitation.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User account not found",
        )

    return {
        "valid": True,
        "email": user.email,
    }


@router.post(
    "/accept/{token}",
    response_model=ParentInvitationAcceptResponse,
)
def accept_invitation(
    token: str,
    data: ParentInvitationAcceptRequest,
    db: Session = Depends(get_db),
):
    invitation = get_valid_parent_invitation(
        db=db,
        raw_token=token,
    )

    user = (
        db.query(User)
        .filter(User.id == invitation.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User account not found",
        )

    if user.role != "parent":
        raise HTTPException(
            status_code=400,
            detail="This invitation is not for a parent account",
        )

    user.password_hash = hash_password(data.password)
    user.is_active = True

    mark_invitation_used(invitation)

    db.add(user)
    db.add(invitation)
    db.commit()

    return {
        "message": "Parent account activated successfully. You can now login with your email and password.",
    }