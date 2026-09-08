from pydantic import BaseModel, ConfigDict


class ExamSubjectCreate(BaseModel):
    exam_id: int
    class_id: int
    subject_id: int


class ExamSubjectResponse(BaseModel):
    exam_id: int
    class_id: int
    subject_id: int

    model_config = ConfigDict(from_attributes=True)