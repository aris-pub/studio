"""Routes to manage paragraph reactions (emoji-style badges on manuscript blocks)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db
from ..authorization import PermissionLevel, has_permission
from ..models.models import Reaction, User


router = APIRouter(
    prefix="/reactions", tags=["reactions"], dependencies=[Depends(current_user)]
)


class ReactionCreate(BaseModel):
    file_id: int
    node_id: str
    reaction_type: str


class ReactionResponse(BaseModel):
    id: int
    file_id: int
    owner_id: int
    node_id: str
    reaction_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=list[ReactionResponse])
async def get_reactions(
    file_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await has_permission(file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    query = (
        select(Reaction)
        .where(and_(Reaction.file_id == file_id, Reaction.owner_id == user.id))
        .order_by(Reaction.created_at)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/", response_model=ReactionResponse)
async def upsert_reaction(
    reaction: ReactionCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await has_permission(reaction.file_id, user.id, PermissionLevel.VIEW, db):
        raise HTTPException(status_code=403, detail="Access denied")

    # Find existing reaction for this user+file+node
    query = select(Reaction).where(
        and_(
            Reaction.file_id == reaction.file_id,
            Reaction.owner_id == user.id,
            Reaction.node_id == reaction.node_id,
        )
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        existing.reaction_type = reaction.reaction_type  # type: ignore
        await db.commit()
        await db.refresh(existing)
        return existing

    db_reaction = Reaction(
        file_id=reaction.file_id,
        owner_id=user.id,
        node_id=reaction.node_id,
        reaction_type=reaction.reaction_type,
    )
    db.add(db_reaction)
    await db.commit()
    await db.refresh(db_reaction)
    return db_reaction


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reaction(
    file_id: int,
    node_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Reaction).where(
        and_(
            Reaction.file_id == file_id,
            Reaction.owner_id == user.id,
            Reaction.node_id == node_id,
        )
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if not existing:
        raise HTTPException(status_code=404, detail="Reaction not found")

    await db.delete(existing)
    await db.commit()
