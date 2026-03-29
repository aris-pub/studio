"""Routes to manage annotations (highlights with optional notes)."""

from datetime import datetime, timezone
from typing import Any, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .. import current_user, get_db
from ..authorization import PermissionLevel, has_permission
from ..models import Annotation, AnnotationMessage
from ..models.models import AnnotationVisibility, User


router = APIRouter(
    prefix="/annotations", tags=["files", "annotations"], dependencies=[Depends(current_user)]
)


class AnchorData(BaseModel):
    node_id: Optional[str] = None
    element_id: Optional[str] = None
    start_offset: int = 0
    end_offset: int = 0
    type: Optional[str] = None
    start_relative: Optional[dict] = None
    end_relative: Optional[dict] = None
    source_start: Optional[int] = None
    source_end: Optional[int] = None


class AnnotationMessageCreate(BaseModel):
    content: str


class AnnotationMessageResponse(BaseModel):
    id: int
    annotation_id: int
    owner_id: int
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    owner: Optional["AnnotationOwnerResponse"] = None

    model_config = ConfigDict(from_attributes=True)


class AnnotationCreate(BaseModel):
    file_id: int
    color: str = "purple"
    anchor_data: AnchorData
    selected_text: str
    visibility: AnnotationVisibility = AnnotationVisibility.PRIVATE


class AnnotationUpdate(BaseModel):
    color: Optional[str] = None
    visibility: Optional[AnnotationVisibility] = None


class AnnotationOwnerResponse(BaseModel):
    id: int
    name: str
    initials: Optional[str] = None
    avatar_color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AnnotationResponse(BaseModel):
    id: int
    file_id: int
    owner_id: int
    color: str
    visibility: AnnotationVisibility
    anchor_data: dict[str, Any]
    selected_text: str
    created_at: datetime
    deleted_at: Optional[datetime] = None
    messages: list[AnnotationMessageResponse] = []
    owner: Optional[AnnotationOwnerResponse] = None

    model_config = ConfigDict(from_attributes=True)


@router.post("/", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    annotation: AnnotationCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
        raise HTTPException(status_code=403, detail="Comment permission required")

    db_annotation = Annotation(
        file_id=annotation.file_id,
        owner_id=user.id,
        color=annotation.color,
        visibility=annotation.visibility,
        anchor_data=annotation.anchor_data.model_dump(),
        selected_text=annotation.selected_text,
    )
    db.add(db_annotation)
    await db.commit()

    # Re-fetch with messages eagerly loaded for serialization
    result = await db.execute(
        select(Annotation)
        .where(Annotation.id == db_annotation.id)
        .options(selectinload(Annotation.messages).selectinload(AnnotationMessage.owner), selectinload(Annotation.owner))
    )
    return result.scalar_one()


@router.get("/", response_model=list[AnnotationResponse])
async def get_annotations(
    file_id: int,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await has_permission(file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(Annotation).options(selectinload(Annotation.messages).selectinload(AnnotationMessage.owner), selectinload(Annotation.owner))

    if not include_deleted:
        query = query.where(Annotation.deleted_at.is_(None))

    query = query.where(Annotation.file_id == file_id)

    # Privacy filter: only see own private annotations + all shared annotations
    query = query.where(
        or_(
            Annotation.owner_id == user.id,
            Annotation.visibility == AnnotationVisibility.SHARED,
        )
    )

    query = query.order_by(Annotation.created_at).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{annotation_id}", response_model=AnnotationResponse)
async def get_annotation(
    annotation_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).options(selectinload(Annotation.messages).selectinload(AnnotationMessage.owner), selectinload(Annotation.owner)).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    if not await has_permission(annotation.file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    # Privacy: can only see own private annotations or shared ones
    if annotation.owner_id != user.id and annotation.visibility != AnnotationVisibility.SHARED:
        raise HTTPException(status_code=404, detail="Annotation not found")

    return annotation


@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    annotation_update: AnnotationUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).options(selectinload(Annotation.messages).selectinload(AnnotationMessage.owner), selectinload(Annotation.owner)).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Only the owner can update their annotation
    if annotation.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own annotations")

    update_data = annotation_update.model_dump(exclude_unset=True)

    # Shared annotations cannot be made private again
    if (
        "visibility" in update_data
        and annotation.visibility == AnnotationVisibility.SHARED
        and update_data["visibility"] == AnnotationVisibility.PRIVATE
    ):
        raise HTTPException(
            status_code=400,
            detail="Shared annotations cannot be made private",
        )

    for field, value in update_data.items():
        setattr(annotation, field, value)

    await db.commit()
    await db.refresh(annotation)
    return annotation


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).options(selectinload(Annotation.messages).selectinload(AnnotationMessage.owner), selectinload(Annotation.owner)).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    is_annotation_owner = annotation.owner_id == user.id
    is_file_owner = await has_permission(annotation.file_id, user.id, PermissionLevel.MANAGE, db)

    if not is_annotation_owner and not is_file_owner:
        raise HTTPException(status_code=403, detail="You can only delete your own annotations")

    # Shared annotations with notes can only be deleted by the file owner
    if annotation.visibility == AnnotationVisibility.SHARED:
        has_notes = any(m for m in annotation.messages if not m.deleted_at)
        if has_notes and not is_file_owner:
            raise HTTPException(
                status_code=403,
                detail="Shared annotations with notes can only be deleted by the file owner",
            )

    annotation.deleted_at = datetime.now(timezone.utc)  # type: ignore
    await db.commit()


# AnnotationMessage CRUD routes (note = optional message on an annotation)
@router.post(
    "/{annotation_id}/messages",
    response_model=AnnotationMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_annotation_message(
    annotation_id: int,
    message: AnnotationMessageCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).options(selectinload(Annotation.messages).selectinload(AnnotationMessage.owner), selectinload(Annotation.owner)).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
        raise HTTPException(status_code=403, detail="Comment permission required")

    # Private annotations: single note only. Shared annotations: unlimited (thread).
    # Lock the annotation row to prevent race conditions where two concurrent
    # requests both pass the count check before either inserts.
    if annotation.visibility != AnnotationVisibility.SHARED:
        await db.execute(
            select(Annotation).where(Annotation.id == annotation_id).with_for_update()
        )
        count_query = select(func.count()).select_from(AnnotationMessage).where(
            and_(
                AnnotationMessage.annotation_id == annotation_id,
                AnnotationMessage.deleted_at.is_(None),
            )
        )
        count_result = await db.execute(count_query)
        if count_result.scalar_one() >= 1:
            raise HTTPException(
                status_code=400, detail="Annotation already has a note"
            )

    db_message = AnnotationMessage(
        annotation_id=annotation_id,
        owner_id=user.id,
        content=message.content,
    )
    db.add(db_message)
    await db.commit()

    result = await db.execute(
        select(AnnotationMessage)
        .where(AnnotationMessage.id == db_message.id)
        .options(selectinload(AnnotationMessage.owner))
    )
    return result.scalar_one()


@router.get("/{annotation_id}/messages", response_model=list[AnnotationMessageResponse])
async def get_annotation_messages(
    annotation_id: int,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    query_annotation = select(Annotation).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query_annotation)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    if not await has_permission(annotation.file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(AnnotationMessage).where(AnnotationMessage.annotation_id == annotation_id)

    if not include_deleted:
        query = query.where(AnnotationMessage.deleted_at.is_(None))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/messages/{message_id}", response_model=AnnotationMessageResponse)
async def get_annotation_message(
    message_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AnnotationMessage).where(
        and_(AnnotationMessage.id == message_id, AnnotationMessage.deleted_at.is_(None))
    )
    result = await db.execute(query)
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    query_annotation = select(Annotation).where(Annotation.id == message.annotation_id)
    result = await db.execute(query_annotation)
    annotation = cast(Optional[Annotation], result.scalar_one_or_none())

    if annotation and not await has_permission(annotation.file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    return message


@router.put("/messages/{message_id}", response_model=AnnotationMessageResponse)
async def update_annotation_message(
    message_id: int,
    message_update: AnnotationMessageCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AnnotationMessage).where(
        and_(AnnotationMessage.id == message_id, AnnotationMessage.deleted_at.is_(None))
    )
    result = await db.execute(query)
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    query_annotation = select(Annotation).where(Annotation.id == message.annotation_id)
    result = await db.execute(query_annotation)
    annotation = cast(Optional[Annotation], result.scalar_one_or_none())

    if annotation:
        if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
            raise HTTPException(status_code=403, detail="Comment permission required")

    if message.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")

    message.content = message_update.content  # type: ignore
    message.updated_at = datetime.now(timezone.utc)  # type: ignore
    await db.commit()

    result = await db.execute(
        select(AnnotationMessage)
        .where(AnnotationMessage.id == message.id)
        .options(selectinload(AnnotationMessage.owner))
    )
    return result.scalar_one()


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation_message(
    message_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AnnotationMessage).where(
        and_(AnnotationMessage.id == message_id, AnnotationMessage.deleted_at.is_(None))
    )
    result = await db.execute(query)
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    query_annotation = select(Annotation).where(Annotation.id == message.annotation_id)
    result = await db.execute(query_annotation)
    annotation = cast(Optional[Annotation], result.scalar_one_or_none())

    if annotation:
        if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
            raise HTTPException(status_code=403, detail="Comment permission required")
        if annotation.visibility == AnnotationVisibility.SHARED:
            raise HTTPException(
                status_code=403, detail="Cannot delete messages on shared annotations"
            )

    if message.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")

    message.deleted_at = datetime.now(timezone.utc)  # type: ignore
    await db.commit()
