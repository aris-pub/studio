"""CRUD operations for signup management.

This module provides database operations for managing early access signups,
including creation, retrieval, updates, and soft deletes.
"""

import json
import secrets
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.engine.result import Result
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Signup, SignupStatus


class SignupError(Exception):
    """Base exception for signup operations."""
    pass


class DuplicateEmailError(SignupError):
    """Raised when attempting to create a signup with an existing email."""
    pass


def generate_unsubscribe_token() -> str:
    """Generate a cryptographically secure unsubscribe token.
    
    Returns
    -------
    str
        A URL-safe, 32-character random token.
    """
    return secrets.token_urlsafe(32)


async def create_signup(
    email: str,
    db: AsyncSession,
    authoring_tools: Optional[list[str]] = None,
    improvements: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    source: Optional[str] = None,
) -> Signup:
    """Create a new signup record.

    Parameters
    ----------
    email : str
        Email address (must be unique).
    authoring_tools : list[str], optional
        List of authoring tools user currently uses.
    improvements : str, optional
        What improvements user would like to see.
    ip_address : str, optional
        IP address for compliance tracking.
    user_agent : str, optional
        User agent string for analytics.
    source : str, optional
        Signup source tracking (e.g., "website", "referral").
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    Signup
        The created signup record.

    Raises
    ------
    DuplicateEmailError
        If email already exists in the database.
    """
    # Convert authoring_tools list to JSON string for storage
    authoring_tools_json = json.dumps(authoring_tools) if authoring_tools is not None else None
    
    signup = Signup(
        email=email,
        authoring_tools=authoring_tools_json,
        improvements=improvements,
        ip_address=ip_address,
        user_agent=user_agent,
        source=source or "website",
        status=SignupStatus.ACTIVE,
        consent_given=True,
        unsubscribe_token=generate_unsubscribe_token()
    )

    db.add(signup)

    try:
        await db.commit()
        await db.refresh(signup)
        return signup
    except IntegrityError as e:
        await db.rollback()
        if "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            raise DuplicateEmailError(f"Email {email} is already registered")
        raise SignupError(f"Database error: {e}") from e


async def get_signup_by_email(email: str, db: AsyncSession) -> Optional[Signup]:
    """Retrieve a signup by email address.

    Parameters
    ----------
    email : str
        Email address to search for.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    Signup or None
        The signup record if found, None otherwise.
    """
    result: Result = await db.execute(
        select(Signup).where(Signup.email == email)
    )
    return result.scalars().first()


async def get_signup_by_id(signup_id: int, db: AsyncSession) -> Optional[Signup]:
    """Retrieve a signup by ID.

    Parameters
    ----------
    signup_id : int
        The unique identifier of the signup.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    Signup or None
        The signup record if found, None otherwise.
    """
    result: Result = await db.execute(
        select(Signup).where(Signup.id == signup_id)
    )
    return result.scalars().first()


async def update_signup_status(
    email: str,
    status: SignupStatus,
    db: AsyncSession
) -> Optional[Signup]:
    """Update the status of a signup.

    Parameters
    ----------
    email : str
        Email address of the signup to update.
    status : SignupStatus
        New status to set.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    Signup or None
        The updated signup record if found, None otherwise.
    """
    signup = await get_signup_by_email(email, db)
    if not signup:
        return None

    signup.status = status
    if status == SignupStatus.UNSUBSCRIBED:
        signup.unsubscribed_at = datetime.now(timezone.utc)
    signup.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(signup)
    return signup


async def unsubscribe_signup(email: str, db: AsyncSession) -> Optional[Signup]:
    """Mark a signup as unsubscribed.

    Parameters
    ----------
    email : str
        Email address to unsubscribe.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    Signup or None
        The updated signup record if found, None otherwise.
    """
    return await update_signup_status(email, SignupStatus.UNSUBSCRIBED, db)


async def email_exists(email: str, db: AsyncSession) -> bool:
    """Check if an email address is already registered.

    Parameters
    ----------
    email : str
        Email address to check.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    bool
        True if email exists, False otherwise.
    """
    result = await db.execute(
        select(Signup.id).where(Signup.email == email).limit(1)
    )
    return result.scalars().first() is not None


async def get_active_signups_count(db: AsyncSession) -> int:
    """Get count of active signups.

    Parameters
    ----------
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    int
        Number of active signups.
    """
    result: Result = await db.execute(
        select(Signup.id).where(Signup.status == SignupStatus.ACTIVE)
    )
    return len(result.scalars().all())


async def get_signup_by_token(token: str, db: AsyncSession) -> Optional[Signup]:
    """Retrieve a signup by unsubscribe token.

    Parameters
    ----------
    token : str
        Unsubscribe token to search for.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    Signup or None
        The signup record if found, None otherwise.
    """
    result: Result = await db.execute(
        select(Signup).where(Signup.unsubscribe_token == token)
    )
    return result.scalars().first()


async def unsubscribe_by_token(token: str, db: AsyncSession) -> Optional[Signup]:
    """Mark a signup as unsubscribed using the unsubscribe token.

    Parameters
    ----------
    token : str
        Unsubscribe token.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    Signup or None
        The updated signup record if found, None otherwise.
    """
    signup = await get_signup_by_token(token, db)
    if not signup:
        return None
    
    signup.status = SignupStatus.UNSUBSCRIBED
    signup.unsubscribed_at = datetime.now(timezone.utc)
    signup.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(signup)
    return signup
