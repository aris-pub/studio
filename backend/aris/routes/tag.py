from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from .. import crud, current_user, get_db
from ..authorization import require_self
from ..exceptions import bad_request_exception, forbidden_exception, not_found_exception
from ..models import User


router = APIRouter(prefix="/users", tags=["users", "tags"], dependencies=[Depends(current_user)])


class TagRetrieveOrUpdate(BaseModel):
    id: int
    user_id: int
    name: str
    color: str


class TagCreate(BaseModel):
    name: str
    color: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Tag name cannot be empty")
        if len(v) < 1:
            raise ValueError("Tag name must be at least 1 character long")
        if len(v) > 50:
            raise ValueError("Tag name cannot exceed 50 characters")
        return v


@router.post(
    "/{user_id}/tags",
    response_model=TagRetrieveOrUpdate,
    status_code=status.HTTP_201_CREATED,
)
async def create_tag(
    user_id: int,
    tag: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_self),
):
    """Create a new tag for the user."""
    user = await crud.get_user(user_id, db)
    if user is None:
        raise not_found_exception("User", user_id)

    tag = await crud.create_tag(user_id, tag.name, tag.color, db)
    if tag is None:
        raise bad_request_exception("Error creating tag")
    return tag


@router.get("/{user_id}/tags", response_model=list[TagRetrieveOrUpdate])
async def get_user_tags(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_self),
):
    """Get all tags for a user."""
    tags = await crud.get_user_tags(user_id, db)
    return tags


@router.put("/{user_id}/tags/{_id}", response_model=TagRetrieveOrUpdate)
async def update_tag(
    tag: TagRetrieveOrUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(current_user),
):
    """Update the name of a tag."""
    if tag.user_id != current_user.id:
        raise forbidden_exception("Not authorized")
    if tag.id not in (t["id"] for t in await crud.get_user_tags(tag.user_id, db)):
        raise not_found_exception("Tag", tag.id)
    try:
        updated_tag = await crud.update_tag(tag.id, tag.user_id, tag.name, tag.color, db)
    except ValueError as e:
        raise bad_request_exception(f"Error updating tag: {e}")
    return updated_tag


@router.delete("/{user_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_self),
):
    """Delete a tag for a user."""
    if tag_id not in (t["id"] for t in await crud.get_user_tags(user_id, db)):
        raise not_found_exception("Tag", tag_id)

    deleted_tag = await crud.soft_delete_tag(tag_id, user_id, db)
    if deleted_tag is None:
        raise bad_request_exception(f"Error deleting tag: {tag_id}")
    return deleted_tag


@router.get("/{user_id}/files/{file_id}/tags")
async def get_user_file_tags(
    user_id: int,
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_self),
):
    """Get a user's tags assigned to the file."""
    try:
        result = await crud.get_user_file_tags(user_id, file_id, db)
    except ValueError as e:
        raise bad_request_exception(f"Error fetching tags for file {file_id}: {e}")
    return result


@router.post("/{user_id}/files/{file_id}/tags/{tag_id}")
async def add_tag_to_file(
    user_id: int,
    file_id: int,
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_self),
):
    """Assign a tag to a file."""
    try:
        await crud.add_tag_to_file(user_id, file_id, tag_id, db)
    except ValueError as e:
        raise bad_request_exception(f"Error adding tag: {e}")
    return {"message": "Tag added successfully"}


@router.delete("/{user_id}/files/{file_id}/tags/{tag_id}")
async def remove_tag_from_file(
    user_id: int,
    file_id: int,
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_self),
):
    """Remove a tag from a file."""
    try:
        await crud.remove_tag_from_file(user_id, file_id, tag_id, db)
    except ValueError as e:
        raise bad_request_exception(f"Error removing tag: {e}")
    return {"message": "Tag removed successfully"}
