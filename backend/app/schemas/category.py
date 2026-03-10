import uuid
from datetime import datetime

from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    description: str | None = None
    parent_id: uuid.UUID | None = None
    icon_url: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parent_id: uuid.UUID | None = None
    icon_url: str | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    parent_id: uuid.UUID | None
    icon_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryTreeResponse(CategoryResponse):
    children: list["CategoryTreeResponse"] = []

    model_config = {"from_attributes": True}
