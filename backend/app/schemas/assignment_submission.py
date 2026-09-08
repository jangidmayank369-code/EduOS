from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AssignmentSubmissionCreate(BaseModel):
    assignment_id: int
    submission_text: str | None = None
class AssignmentSubmissionUpdate(BaseModel):
    marks_obtained: float
    feedback: str | None = None

class AssignmentSubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    submission_text: str | None = Field(default=None, max_length=5000)
    submitted_at: datetime
    marks_obtained: float | None
    feedback: str | None
    status: str

    model_config = ConfigDict(from_attributes=True)
