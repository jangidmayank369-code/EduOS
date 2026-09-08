from pydantic import BaseModel, ConfigDict


class TeacherAssignmentCreate(BaseModel):
    teacher_id: int
    class_id: int
    subject_id: int


class TeacherSummary(BaseModel):
    id: int
    first_name: str
    last_name: str

    model_config = ConfigDict(from_attributes=True)


class ClassSummary(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SubjectSummary(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)


class TeacherAssignmentResponse(BaseModel):
    teacher_id: int
    class_id: int
    subject_id: int

    teacher: TeacherSummary
    school_class: ClassSummary
    subject: SubjectSummary

    model_config = ConfigDict(from_attributes=True)