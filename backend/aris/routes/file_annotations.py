"""Routes to manage annotations (notes and comments)."""

from datetime import datetime, timezone
from typing import Optional, cast

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db
from ..authorization import PermissionLevel, has_permission
from ..models import Annotation, AnnotationMessage, AnnotationType
from ..models.models import User


router = APIRouter(
    prefix="/annotations", tags=["files", "annotations"], dependencies=[Depends(current_user)]
)


class AnnotationMessageCreate(BaseModel):
    content: str
    owner_id: int


class AnnotationMessageResponse(BaseModel):
    id: int
    annotation_id: int
    owner_id: int
    content: str
    created_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AnnotationCreate(BaseModel):
    file_id: int
    type: AnnotationType


class AnnotationUpdate(BaseModel):
    type: Optional[AnnotationType] = None


class AnnotationResponse(BaseModel):
    id: int
    file_id: int
    type: AnnotationType
    created_at: datetime
    deleted_at: Optional[datetime] = None
    messages: list[AnnotationMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)


@router.post("/", response_model=AnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    annotation: AnnotationCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check COMMENT permission on the file
    if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
        raise HTTPException(status_code=403, detail="Comment permission required")

    db_annotation = Annotation(**annotation.dict())
    db.add(db_annotation)
    await db.commit()
    await db.refresh(db_annotation)
    return db_annotation


@router.get("/", response_model=list[AnnotationResponse])
async def get_annotations(
    file_id: Optional[int] = None,
    type: Optional[AnnotationType] = None,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check VIEW permission if file_id is provided
    if file_id:
        if not await has_permission(file_id, user.id, PermissionLevel.VIEW, db):
            raise HTTPException(status_code=403, detail="Access denied")

    query = select(Annotation)

    if not include_deleted:
        query = query.where(Annotation.deleted_at.is_(None))

    if file_id:
        query = query.where(Annotation.file_id == file_id)

    if type:
        query = query.where(Annotation.type == type)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{annotation_id}", response_model=AnnotationResponse)
async def get_annotation(
    annotation_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Check VIEW permission on the annotation's file
    if not await has_permission(annotation.file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    return annotation


@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    annotation_update: AnnotationUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Check COMMENT permission on the annotation's file
    if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
        raise HTTPException(status_code=403, detail="Comment permission required")

    update_data = annotation_update.dict(exclude_unset=True)
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
    query = select(Annotation).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Check COMMENT permission on the annotation's file
    if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
        raise HTTPException(status_code=403, detail="Comment permission required")

    annotation.deleted_at = datetime.now(timezone.utc)  # type: ignore
    await db.commit()


# AnnotationMessage CRUD routes
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
    # Verify annotation exists
    query = select(Annotation).where(
        and_(Annotation.id == annotation_id, Annotation.deleted_at.is_(None))
    )
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Check COMMENT permission on the annotation's file
    if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
        raise HTTPException(status_code=403, detail="Comment permission required")

    # Check constraint: notes can only have one non-deleted message
    if annotation.type == AnnotationType.NOTE:
        count_query = select(AnnotationMessage).where(
            and_(
                AnnotationMessage.annotation_id == annotation_id,
                AnnotationMessage.deleted_at.is_(None),
            )
        )
        count_result = await db.execute(count_query)
        existing_messages = count_result.scalars().all()
        existing_count = len(existing_messages)

        if existing_count >= 1:
            raise HTTPException(
                status_code=400, detail="Note annotations can only have one message"
            )

    db_message = AnnotationMessage(annotation_id=annotation_id, **message.dict())
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)
    return db_message


@router.get("/{annotation_id}/messages", response_model=list[AnnotationMessageResponse])
async def get_annotation_messages(
    annotation_id: int,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify annotation exists and check VIEW permission
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

    # Get the annotation to check file permission
    query_annotation = select(Annotation).where(Annotation.id == message.annotation_id)
    result = await db.execute(query_annotation)
    annotation = cast(Optional[Annotation], result.scalar_one_or_none())

    if annotation and not await has_permission(annotation.file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    return message


@router.put("/messages/{message_id}", response_model=AnnotationMessageResponse)
async def update_annotation_message(
    message_id: int,
    content: str,
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

    # Get the annotation to check file permission
    query_annotation = select(Annotation).where(Annotation.id == message.annotation_id)
    result = await db.execute(query_annotation)
    annotation = cast(Optional[Annotation], result.scalar_one_or_none())

    if annotation:
        if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
            raise HTTPException(status_code=403, detail="Comment permission required")

    # Check message ownership
    if message.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")

    message.content = content  # type: ignore
    await db.commit()
    await db.refresh(message)
    return message


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

    # Get the annotation to check file permission
    query_annotation = select(Annotation).where(Annotation.id == message.annotation_id)
    result = await db.execute(query_annotation)
    annotation = cast(Optional[Annotation], result.scalar_one_or_none())

    if annotation:
        if not await has_permission(annotation.file_id, user.id, PermissionLevel.COMMENT, db):
            raise HTTPException(status_code=403, detail="Comment permission required")

    # Check message ownership
    if message.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")

    message.deleted_at = datetime.now(timezone.utc)  # type: ignore
    await db.commit()
