from pydantic import BaseModel, ConfigDict, Field


class ParentChildCreate(BaseModel):
    parent_id: int
    student_id: int
    relation_type: str = Field(
        default="GUARDIAN",
        min_length=2,
        max_length=30,
    )
    is_primary: bool = False
    is_emergency_contact: bool = False
    receives_notifications: bool = True


class ParentChildUpdate(BaseModel):
    relation_type: str | None = Field(
        default=None,
        min_length=2,
        max_length=30,
    )
    is_primary: bool | None = None
    is_emergency_contact: bool | None = None
    receives_notifications: bool | None = None


class ChildSummary(BaseModel):
    id: int
    admission_number: str
    first_name: str
    last_name: str
    class_id: int | None

    model_config = ConfigDict(from_attributes=True)


class ParentChildResponse(BaseModel):
    parent_id: int
    student_id: int
    relation_type: str
    is_primary: bool
    is_emergency_contact: bool
    receives_notifications: bool
    created_at: object
    updated_at: object
    student: ChildSummary | None = None

    model_config = ConfigDict(from_attributes=True)