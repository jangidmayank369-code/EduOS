from pydantic import BaseModel, Field


class FeeGenerationRequest(BaseModel):
    fee_structure_id: int = Field(gt=0)
    academic_session_id: int = Field(gt=0)
    class_id: int = Field(gt=0)


class FeeGenerationResponse(BaseModel):
    generated: int
    skipped: int
    message: str