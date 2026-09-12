from pydantic import BaseModel, ConfigDict, Field


class TeacherWorkspaceParent(BaseModel):
    parent_id: int
    first_name: str
    last_name: str
    phone: str | None = None
    relation_type: str
    is_primary: bool
    is_emergency_contact: bool
    receives_notifications: bool


class TeacherWorkspaceStudent(BaseModel):
    id: int
    admission_number: str
    first_name: str
    last_name: str
    class_id: int | None = None
    section_id: int | None = None
    phone: str | None = None
    is_active: bool
    status: str
    parents: list[TeacherWorkspaceParent] = Field(default_factory=list)


class TeacherWorkspaceSubject(BaseModel):
    id: int
    name: str
    code: str
    section_id: int


class TeacherWorkspaceSection(BaseModel):
    id: int
    class_id: int
    class_name: str
    name: str
    class_teacher_id: int | None = None
    is_class_teacher: bool
    subjects: list[TeacherWorkspaceSubject] = Field(default_factory=list)
    students: list[TeacherWorkspaceStudent] = Field(default_factory=list)


class TeacherWorkspaceTeacher(BaseModel):
    id: int
    employee_number: str | None = None
    first_name: str
    last_name: str
    phone: str | None = None
    email: str | None = None


class TeacherWorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    teacher: TeacherWorkspaceTeacher
    sections: list[TeacherWorkspaceSection]
    total_sections: int
    total_students: int
    total_subject_assignments: int
    class_teacher_sections: int

