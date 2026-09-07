from app.models import User
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import RegisterRequest, RegisterResponse
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import hash_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse)
def register_user(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == data.email).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered"
        )

    hashed_password = hash_password(data.password)

    new_user = User(
        email=data.email,
        password_hash=hashed_password,
        role=data.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
    "id": new_user.id,
    "email": new_user.email,
    "role": new_user.role,
}