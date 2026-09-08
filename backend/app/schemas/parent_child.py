from pydantic import BaseModel


class ParentChildCreate(BaseModel):
    parent_id: int
    student_id: int


class ChildSummary(BaseModel):
    id: int
    admission_number: str
    first_name: str
    last_name: str
    class_id: int | None

    class Config:
        from_attributes = True


class ParentChildResponse(BaseModel):
    parent_id: int
    student_id: int
    student: ChildSummary | None = None

    class Config:
        from_attributes = True