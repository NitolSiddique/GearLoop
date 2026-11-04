from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Whitespace is stripped first, then the length is checked, so "   " is rejected.
CategoryName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class CategoryCreate(BaseModel):
    name: CategoryName
    description: str | None = Field(default=None, max_length=1000)


class CategoryUpdate(BaseModel):
    name: CategoryName
    description: str | None = Field(default=None, max_length=1000)


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
