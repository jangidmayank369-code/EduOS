from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
DATABASE_URL = "postgresql+psycopg://postgres:Mkj%2312122006%23@localhost:5432/eduos"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
class Base(DeclarativeBase):
    pass
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()