from pydantic import BaseModel, ConfigDict, Field


class SectionSubjectTeacherCreate(BaseModel):
    section_id: int = Field(gt=0)
    subject_id: int = Field(gt=0)
    teacher_id: int = Field(gt=0)


class SectionSubjectTeacherUpdate(BaseModel):
    teacher_id: int = Field(gt=0)


class SectionSubjectTeacherResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    subject_id: int
    teacher_id: int
    is_active: bool