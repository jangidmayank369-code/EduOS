from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.students import router as students_router
from app.api.classes import router as classes_router
from app.api.subjects import router as subjects_router
from app.api.co_scholastic import router as co_scholastic_router
from app.api.sections import router as sections_router
from app.api.section_academics import router as section_academics_router
from app.api.teachers import router as teachers_router
from app.api.teacher_assignments import router as teacher_assignments_router
from app.api.attendance import router as attendance_router
from app.api.exams import router as exams_router
from app.api.exam_subjects import router as exam_subjects_router
from app.api.marks import router as marks_router
from app.api.results import router as results_router
from app.api.parents import router as parents_router
from app.api.parent_children import router as parent_children_router
from app.api.fees import router as fees_router
from app.api.notices import router as notices_router
from app.api.timetable import router as timetable_router
from app.api.assignments import router as assignments_router
from app.api.assignment_submissions import router as assignment_submissions_router
from app.api.notifications import router as notifications_router
from app.api.users import router as users_router
from app.api.roles import router as roles_router
from app.api.dashboard import router as dashboard_router
from app.api.academic_sessions import router as academic_sessions_router
from app.api.admissions import router as admissions_router
from app.api.parent_invitations import router as parent_invitations_router
from app.api.student_bulk_import import router as student_bulk_import_router
from app.api.student_bulk_update import router as student_bulk_update_router
from app.api.teacher_employment import router as teacher_employment_router
from app.api.teacher_academic import router as teacher_academic_router
from app.api.teacher_attendance import router as teacher_attendance_router
from app.api.teacher_salary import router as teacher_salary_router
from app.api.teacher_document import router as teacher_document_router
from app.api.teacher_360 import router as teacher_360_router
from app.api.teacher_tasks import router as teacher_tasks_router
from app.api.teacher_workspace import router as teacher_workspace_router
app = FastAPI()


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(students_router)
app.include_router(classes_router)
app.include_router(subjects_router)
app.include_router(co_scholastic_router)
app.include_router(sections_router)
app.include_router(section_academics_router)
app.include_router(teachers_router)
app.include_router(teacher_assignments_router)
app.include_router(attendance_router)
app.include_router(exams_router)
app.include_router(exam_subjects_router)
app.include_router(marks_router)
app.include_router(results_router)
app.include_router(parents_router)
app.include_router(parent_children_router)
app.include_router(fees_router)
app.include_router(notices_router)
app.include_router(timetable_router)
app.include_router(assignments_router)
app.include_router(assignment_submissions_router)
app.include_router(notifications_router)
app.include_router(users_router)
app.include_router(roles_router)
app.include_router(dashboard_router)
app.include_router(academic_sessions_router)
app.include_router(admissions_router)
app.include_router(parent_invitations_router)
app.include_router(student_bulk_import_router)
app.include_router(student_bulk_update_router)
app.include_router(teacher_employment_router)
app.include_router(teacher_academic_router)
app.include_router(teacher_attendance_router)
app.include_router(teacher_salary_router)
app.include_router(teacher_document_router)
app.include_router(teacher_360_router)
app.include_router(teacher_tasks_router)
app.include_router(teacher_workspace_router)
# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "EduOS backend is running"
    }