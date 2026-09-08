from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoticeCreate(BaseModel):
    title: str
    content: str
    target_role: str = "all"


class NoticeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    target_role: str | None = None
    is_active: bool | None = None


class NoticeResponse(BaseModel):
    id: int
    title: str
    content: str
    target_role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)