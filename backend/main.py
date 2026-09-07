from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.api.students import router as students_router
from app.api.classes import router as classes_router
from app.api.subjects import router as subjects_router
app = FastAPI()

app.include_router(auth_router)
app.include_router(students_router)
app.include_router(classes_router)
app.include_router(subjects_router)
@app.get("/")
def root():
    return {"message": "EduOS backend is running"}