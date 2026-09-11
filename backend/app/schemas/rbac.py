from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# =========================================================
# Permission Schemas
# =========================================================

class PermissionResponse(BaseModel):
    id: int
    code: str
    name: str
    module: str
    description: str | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# Role Permission Schemas
# =========================================================

class RolePermissionResponse(BaseModel):
    id: int
    permission_id: int
    allowed: bool
    permission: PermissionResponse

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# Role Schemas
# =========================================================

class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    description: str | None = Field(
        default=None,
        max_length=255,
    )


class RoleUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=50,
    )
    description: str | None = Field(
        default=None,
        max_length=255,
    )
    is_active: bool | None = None


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleDetailResponse(RoleResponse):
    permissions: list[RolePermissionResponse] = []


# =========================================================
# Role Permission Management
# =========================================================

class RolePermissionUpdate(BaseModel):
    permission_id: int
    allowed: bool = True


class RolePermissionsUpdate(BaseModel):
    permissions: list[RolePermissionUpdate]


# =========================================================
# Role List Response
# =========================================================

class RoleListResponse(BaseModel):
    items: list[RoleResponse]
    total: int