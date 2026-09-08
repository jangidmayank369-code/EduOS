from pydantic import BaseModel, Field


class ParentInvitationResponse(BaseModel):
    message: str
    invitation_token: str


class ParentInvitationValidateResponse(BaseModel):
    valid: bool
    email: str


class ParentInvitationAcceptRequest(BaseModel):
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class ParentInvitationAcceptResponse(BaseModel):
    message: str