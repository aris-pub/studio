import base64
import json
import re
import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .. import crud, current_user, get_db
from ..config import settings
from ..exceptions import bad_request_exception, not_found_exception
from ..models import ProfilePicture, User
from ..security import hash_password, verify_password
from ..services.email import get_email_service


_lookup_timestamps: dict[int, deque] = defaultdict(lambda: deque(maxlen=10))
_LOOKUP_RATE_LIMIT = 10


def sanitize_filename(name: str) -> str:
    """Replace characters unsafe in filenames with hyphens, collapse runs, and trim."""
    safe = re.sub(r'[\/\\:*?"<>|#%\x00-\x1f]', "-", name)
    safe = re.sub(r"\s+", "-", safe)
    safe = re.sub(r"-{2,}", "-", safe)
    return safe.strip("-")


_LOOKUP_WINDOW = 60

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(current_user)])


# @router.get("")
# async def get_users(db: AsyncSession = Depends(get_db)):
#     return await crud.get_users(db)


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve a specific user by ID.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to retrieve.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    User
        The user object if found.

    Raises
    ------
    HTTPException
        404 error if user is not found or has been deleted.

    Notes
    -----
    Requires authentication. Only returns non-deleted users.
    """
    user = await crud.get_user(user_id, db)
    if not user:
        raise not_found_exception("User", user_id)
    return user


class UserLookupRequest(BaseModel):
    email: str


@router.post("/lookup")
async def lookup_user(
    request: UserLookupRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    now = time.monotonic()
    timestamps = _lookup_timestamps[int(user.id)]
    while timestamps and now - timestamps[0] > _LOOKUP_WINDOW:
        timestamps.popleft()
    if len(timestamps) >= _LOOKUP_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many lookups. Try again later.")
    timestamps.append(now)

    result = await db.execute(
        select(User).where(
            func.lower(User.email) == request.email.strip().lower(),
            User.deleted_at.is_(None),
        )
    )
    found = result.scalar_one_or_none()
    if not found:
        raise HTTPException(status_code=404, detail="No account found for this email")

    return {
        "user_id": found.id,
        "name": found.name,
        "initials": found.initials,
        "avatar_color": found.avatar_color.value if found.avatar_color else None,
    }


class UserUpdate(BaseModel):
    name: str
    initials: str
    email: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    
    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('New password must be at least 8 characters long')
        return v


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    update: UserUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update user profile information.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to update.
    update : UserUpdate
        Updated user data including name, initials, and email.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    User
        The updated user object.

    Raises
    ------
    HTTPException
        404 error if user is not found.

    Notes
    -----
    Requires authentication. Updates only the provided fields.
    """
    user = await crud.update_user(user_id, update.name, update.initials, update.email, db)
    if not user:
        raise not_found_exception("User", user_id)
    return user


@router.post("/{user_id}/change-password")
async def change_password(
    user_id: int,
    password_data: PasswordChange,
    db: AsyncSession = Depends(get_db),
):
    """Change user password.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to update password for.
    password_data : PasswordChange
        Current and new password data.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Success message.

    Raises
    ------
    HTTPException
        401 error if current password is incorrect.
        404 error if user is not found.
        422 error if password validation fails.

    Notes
    -----
    Requires authentication. Validates current password before updating.
    New password must be at least 8 characters long.
    """
    user = await crud.get_user(user_id, db)
    if not user:
        raise not_found_exception("User", user_id)
    
    # Verify current password
    if not verify_password(password_data.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Hash new password and update
    user.password_hash = hash_password(password_data.new_password)
    await db.commit()
    await db.refresh(user)
    
    return {"message": "Password changed successfully"}


@router.post("/{user_id}/send-verification")
async def send_verification_email(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Send email verification link to user.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to send verification email to.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Success message.

    Raises
    ------
    HTTPException
        404 error if user is not found.
        400 error if email is already verified.

    Notes
    -----
    Requires authentication. Generates verification token and stores it.
    In production, this would send an actual email with the verification link.
    """
    user = await crud.get_user(user_id, db)
    if not user:
        raise not_found_exception("User", user_id)
    
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")
    
    token = user.generate_verification_token()
    user.email_verification_sent_at = datetime.now(UTC)
    await db.commit()

    email_service = get_email_service()
    if email_service:
        await email_service.send_verification_email(
            to_email=user.email,
            name=user.name,
            token=token,
            frontend_url=settings.FRONTEND_URL,
        )

    return {"message": "Verification email sent successfully"}


# Create a separate router for public endpoints (no auth required)
public_router = APIRouter(prefix="/users", tags=["users"])


@public_router.post("/verify-email/{token}")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Verify user email using verification token.

    Parameters
    ----------
    token : str
        The verification token sent to the user's email.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Success message.

    Raises
    ------
    HTTPException
        404 error if token is invalid or user not found.
        400 error if email is already verified.

    Notes
    -----
    Public endpoint - no authentication required.
    Verifies the token and marks the email as verified.
    """
    # Find user by verification token
    result = await db.execute(
        select(User).where(
            User.email_verification_token == token,
            User.deleted_at.is_(None)
        )
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Invalid verification token")
    
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")
    
    # Mark email as verified and clear token
    user.email_verified = True  # type: ignore
    user.email_verification_token = None  # type: ignore
    user.email_verification_sent_at = None  # type: ignore
    await db.commit()
    
    return {"message": "Email verified successfully"}


@router.delete("/{user_id}")
async def soft_delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    """Soft delete a user account.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to delete.
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        Success message confirming the deletion.

    Raises
    ------
    HTTPException
        404 error if user is not found.

    Notes
    -----
    Requires authentication. Sets deleted_at timestamp instead of
    permanently removing the record.
    """
    user = await crud.soft_delete_user(user_id, db)
    if not user:
        raise not_found_exception("User", user_id)
    return {"message": f"User {user_id} soft deleted"}


@router.get("/{user_id}/files")
async def get_user_files(
    user_id: int,
    with_tags: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all files owned by a user.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user whose files to retrieve.
    with_tags : bool, optional
        Whether to include tag information for each file (default: True).
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    list of dict
        List of file objects with metadata and optional tags.

    Raises
    ------
    HTTPException
        404 error if user is not found.

    Notes
    -----
    Requires authentication. Returns files ordered by last edited date.
    """
    import logging
    logger = logging.getLogger("aris.routes.user")
    logger.info(f"[get_user_files route] Called for user_id={user_id}, with_tags={with_tags}")
    logger.info(f"[get_user_files route] DB session: {db}, in_transaction: {db.in_transaction()}")

    try:
        result = await crud.get_user_files(user_id, with_tags, db)
        logger.info(f"[get_user_files route] Success: returning {len(result)} files")

        # Add rendered HTML for home page minimap
        from ..services.file_service import get_file_service
        file_service = get_file_service()
        await file_service.sync_from_database(db)
        for f in result:
            html = await file_service.get_file_html(f["id"], db=db)
            f["html"] = html or ""

        return result
    except ValueError as e:
        logger.error(f"[get_user_files route] ValueError: {e}")
        raise not_found_exception("User", user_id)


@router.get("/{user_id}/files/{file_id}")
async def get_user_file(
    user_id: int,
    file_id: int,
    with_tags: bool = True,
    with_minimap: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a specific file owned by a user.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user who owns the file.
    file_id : int
        The unique identifier of the file to retrieve.
    with_tags : bool, optional
        Whether to include tag information (default: True).
    with_minimap : bool, optional
        Whether to include minimap section content (default: True).
    db : AsyncSession
        SQLAlchemy async database session dependency.

    Returns
    -------
    dict
        File object with metadata, content, and optional tags/minimap.

    Raises
    ------
    HTTPException
        404 error if user or file is not found.

    Notes
    -----
    Requires authentication. Includes extracted title and optional metadata.
    """
    try:
        return await crud.get_user_file(user_id, file_id, with_tags, with_minimap, db)
    except ValueError as e:
        # The ValueError from CRUD contains specific information about what wasn't found
        if "User" in str(e):
            raise not_found_exception("User", user_id)
        elif "File" in str(e):
            raise not_found_exception("File", file_id)
        else:
            raise bad_request_exception(str(e))


# Maximum file size (5MB)
MAX_FILE_SIZE = 5 * 1024 * 1024
# Allowed MIME types
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@router.post("/{user_id}/avatar")
async def upload_profile_picture(
    user_id: int,
    avatar: UploadFile = File(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(current_user),
):
    """Upload or update a user's profile picture.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user whose avatar to update.
    avatar : UploadFile
        Image file upload (JPEG, PNG, GIF, or WebP format).
    db : AsyncSession
        SQLAlchemy async database session dependency.
    current_user : User
        Current authenticated user dependency.

    Returns
    -------
    dict
        Success message with new picture ID.

    Raises
    ------
    HTTPException
        403 error if user is not authorized to update this profile.
        400 error if file type is invalid or file is too large.
        404 error if user is not found.
        500 error if upload fails.

    Notes
    -----
    Maximum file size is 5MB. Allowed formats: JPEG, PNG, GIF, WebP.
    Soft deletes existing profile picture before creating new one.
    Stores image as base64-encoded content in database.
    """
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")
    if avatar.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}",
        )

    # Read file content
    content = await avatar.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size too large. Maximum allowed: {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )
    base64_content = base64.b64encode(content).decode("utf-8")

    try:
        # Get the user
        query = (
            select(User)
            .options(selectinload(User.profile_picture))
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Soft delete existing profile picture if it exists
        if user.profile_picture and not user.profile_picture.deleted_at:
            user.profile_picture.deleted_at = datetime.now(UTC)

        # Create new profile picture
        new_picture = ProfilePicture(
            filename=avatar.filename, mime_type=avatar.content_type, content=base64_content
        )
        db.add(new_picture)
        await db.flush()  # Get the ID without committing
        user.profile_picture_id = new_picture.id
        await db.commit()
        await db.refresh(new_picture)

        return {
            "message": "Profile picture uploaded successfully",
            "picture_id": new_picture.id,
        }

    except TypeError:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to upload profile picture")


@router.get("/{user_id}/avatar")
async def get_profile_picture(
    user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(current_user)
):
    """Retrieve a user's profile picture.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user whose avatar to retrieve.
    db : AsyncSession
        SQLAlchemy async database session dependency.
    current_user : User
        Current authenticated user dependency.

    Returns
    -------
    Response
        Image file response with appropriate Content-Type and caching headers.

    Raises
    ------
    HTTPException
        403 error if user is not authorized to retrieve this profile.
        404 error if user or profile picture is not found.
        500 error if image data is corrupted.

    Notes
    -----
    Returns binary image data with appropriate MIME type.
    Includes caching headers for better performance.
    Only allows users to retrieve their own profile pictures.
    """
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to retrieve this profile")

    query = (
        select(User)
        .options(selectinload(User.profile_picture))
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.profile_picture or user.profile_picture.deleted_at:
        raise HTTPException(status_code=404, detail="Profile picture not found")
    profile_picture = user.profile_picture

    try:
        image_data = base64.b64decode(profile_picture.content)
    except ValueError:
        raise HTTPException(status_code=500, detail="Invalid image data")

    return Response(
        content=image_data,
        media_type=profile_picture.mime_type,
        headers={
            "Content-Disposition": f"inline; filename={profile_picture.filename}",
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.delete("/{user_id}/avatar")
async def delete_profile_picture(
    user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(current_user)
):
    """Delete a user's profile picture (soft delete).

    Parameters
    ----------
    user_id : int
        The unique identifier of the user whose avatar to delete.
    db : AsyncSession
        SQLAlchemy async database session dependency.
    current_user : User
        Current authenticated user dependency.

    Returns
    -------
    dict
        Success message confirming the deletion.

    Raises
    ------
    HTTPException
        403 error if user is not authorized to delete this profile.
        404 error if user or profile picture is not found.
        500 error if deletion fails.

    Notes
    -----
    Performs soft delete by setting deleted_at timestamp.
    Clears the profile_picture_id reference from the user record.
    Only allows users to delete their own profile pictures.
    """
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this profile")

    try:
        query = select(User).options(selectinload(User.profile_picture)).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.profile_picture or user.profile_picture.deleted_at:
            raise HTTPException(status_code=404, detail="Profile picture not found")

        # Soft delete the profile picture
        user.profile_picture.deleted_at = datetime.now(UTC)
        user.profile_picture_id = None  # type: ignore
        await db.commit()
        return {"message": "Profile picture deleted successfully"}

    except HTTPException:
        raise
    except ValueError:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete profile picture")


@router.get("/{user_id}/export")
async def export_user_data(
    user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(current_user)
):
    """Export all user data in JSON format.
    
    Parameters
    ----------
    user_id : int
        The unique identifier of the user whose data to export.
    db : AsyncSession
        SQLAlchemy async database session dependency.
    current_user : User
        Current authenticated user dependency.

    Returns
    -------
    Response
        JSON file download containing all user data including files, settings, tags, etc.
        
    Raises
    ------
    HTTPException
        403 error if user is not authorized to export this data.
        404 error if user is not found.

    Notes
    -----
    Exports complete user data for backup or migration purposes.
    Includes manuscripts, settings, tags, file assets, and account information.
    Only allows users to export their own data.
    """
    # Ensure user can only export their own data
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to export this user's data")
    
    try:
        # Get user with all related data
        query = (
            select(User)
            .options(
                selectinload(User.files),
                selectinload(User.tags),
                selectinload(User.file_settings),
                selectinload(User.user_settings),
                selectinload(User.file_assets),
                selectinload(User.profile_picture),
            )
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Build export data structure
        export_data: Dict[str, Any] = {
            "export_info": {
                "exported_at": datetime.now(UTC).isoformat(),
                "user_id": user.id,
                "format_version": "1.0",
            },
            "user_profile": {
                "name": user.name,
                "email": user.email,
                "initials": user.initials,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "avatar_color": user.avatar_color.value if user.avatar_color else None,
            },
            "files": [],
            "tags": [],
            "user_settings": None,
            "file_settings": [],
            "file_assets": [],
        }

        # Add files
        files_list: List[Dict[str, Any]] = export_data["files"]
        for file in user.files:
            if not file.deleted_at:
                files_list.append(
                    {
                        "id": file.id,
                        "title": file.title,
                        "source": file.source,
                        "abstract": file.abstract,
                        "keywords": file.keywords,
                        "status": file.status.value if file.status else None,
                        "doi": file.doi,
                        "created_at": file.created_at.isoformat() if file.created_at else None,
                        "last_edited_at": file.last_edited_at.isoformat()
                        if file.last_edited_at
                        else None,
                    }
                )

        # Add tags
        tags_list: List[Dict[str, Any]] = export_data["tags"]
        for tag in user.tags:
            if not tag.deleted_at:
                tags_list.append(
                    {
                        "id": tag.id,
                        "name": tag.name,
                        "color": tag.color,
                        "created_at": tag.created_at.isoformat() if tag.created_at else None,
                    }
                )

        # Add user settings
        if user.user_settings and not user.user_settings.deleted_at:
            settings = user.user_settings
            export_data["user_settings"] = {
                "auto_save_interval": settings.auto_save_interval,
                "focus_mode_auto_hide": settings.focus_mode_auto_hide,
                "sidebar_auto_collapse": settings.sidebar_auto_collapse,
                "drawer_default_annotations": settings.drawer_default_annotations,
                "drawer_default_margins": settings.drawer_default_margins,
                "drawer_default_settings": settings.drawer_default_settings,
                "sound_notifications": settings.sound_notifications,
                "auto_compile_delay": settings.auto_compile_delay,
                "mobile_menu_behavior": settings.mobile_menu_behavior,
                "allow_anonymous_feedback": settings.allow_anonymous_feedback,
                "email_digest_frequency": settings.email_digest_frequency,
                "notification_preference": settings.notification_preference,
                "notification_mentions": settings.notification_mentions,
                "notification_comments": settings.notification_comments,
                "notification_shares": settings.notification_shares,
                "notification_system": settings.notification_system,
                "created_at": settings.created_at.isoformat() if settings.created_at else None,
                "updated_at": settings.updated_at.isoformat() if settings.updated_at else None,
            }

        # Add file settings
        file_settings_list: List[Dict[str, Any]] = export_data["file_settings"]
        for file_setting in user.file_settings:
            if not file_setting.deleted_at:
                file_settings_list.append(
                    {
                        "file_id": file_setting.file_id,
                        "background": file_setting.background,
                        "font_size": file_setting.font_size,
                        "line_height": file_setting.line_height,
                        "font_family": file_setting.font_family,
                        "margin_width": file_setting.margin_width,
                        "columns": file_setting.columns,
                        "created_at": file_setting.created_at.isoformat()
                        if file_setting.created_at
                        else None,
                        "updated_at": file_setting.updated_at.isoformat()
                        if file_setting.updated_at
                        else None,
                    }
                )

        # Add file assets (without binary content for size reasons)
        file_assets_list: List[Dict[str, Any]] = export_data["file_assets"]
        for asset in user.file_assets:
            if not asset.deleted_at:
                file_assets_list.append(
                    {
                        "id": asset.id,
                        "file_id": asset.file_id,
                        "filename": asset.filename,
                        "mime_type": asset.mime_type,
                        "uploaded_at": asset.uploaded_at.isoformat() if asset.uploaded_at else None,
                        "note": "Binary content excluded from export for file size reasons",
                    }
                )

        # Create JSON response
        json_data = json.dumps(export_data, indent=2, ensure_ascii=False)

        safe_name = sanitize_filename(user.name)
        filename = f"{safe_name}-data-export.json"

        return Response(
            content=json_data,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/json; charset=utf-8",
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")
