from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.parent_invitation import ParentInvitation
from app.models.user import User


INVITATION_EXPIRY_HOURS = 48


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def create_parent_invitation(
    db: Session,
    user: User,
) -> str:
    # Invalidate previous unused invitations
    existing_invitations = (
        db.query(ParentInvitation)
        .filter(
            ParentInvitation.user_id == user.id,
            ParentInvitation.used_at.is_(None),
        )
        .all()
    )

    for invitation in existing_invitations:
        invitation.used_at = datetime.utcnow()

    # Generate cryptographically secure raw token
    raw_token = secrets.token_urlsafe(48)

    token_hash = hash_invitation_token(raw_token)

    invitation = ParentInvitation(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=(
            datetime.utcnow()
            + timedelta(hours=INVITATION_EXPIRY_HOURS)
        ),
    )

    db.add(invitation)
    db.flush()

    return raw_token


def get_valid_parent_invitation(
    db: Session,
    raw_token: str,
) -> ParentInvitation:
    token_hash = hash_invitation_token(raw_token)

    invitation = (
        db.query(ParentInvitation)
        .filter(
            ParentInvitation.token_hash == token_hash
        )
        .first()
    )

    if not invitation:
        raise HTTPException(
            status_code=400,
            detail="Invalid invitation token.",
        )

    if invitation.used_at is not None:
        raise HTTPException(
            status_code=400,
            detail="This invitation has already been used.",
        )

    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="This invitation has expired.",
        )

    return invitation


def mark_invitation_used(
    invitation: ParentInvitation,
) -> None:
    invitation.used_at = datetime.utcnow()