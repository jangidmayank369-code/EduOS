from pydantic import BaseModel


class ResultSubjectResponse(BaseModel):
    subject_id: int
    subject_name: str
    marks_obtained: float
    max_marks: float
    percentage: float
    grade: str


class ResultResponse(BaseModel):
    student_id: int
    exam_id: int
    subjects: list[ResultSubjectResponse]
    total_marks: float
    max_marks: float
    percentage: float
    grade: str