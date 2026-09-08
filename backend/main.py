from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.students import router as students_router
from app.api.classes import router as classes_router
from app.api.subjects import router as subjects_router
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
from app.api.dashboard import router as dashboard_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(students_router)
app.include_router(classes_router)
app.include_router(subjects_router)
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
app.include_router(dashboard_router)


@app.get("/")
def root():
    return {"message": "EduOS backend is running"}