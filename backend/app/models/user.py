from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
updated_at: Mapped[datetime] = mapped_column(
    default=datetime.utcnow,
    onupdate=datetime.utcnow
)