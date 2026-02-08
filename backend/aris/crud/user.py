import asyncio
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import case, desc, select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import File, FileSettings, User
from ..models.models import FilePermission, FileRole
from .file import get_file, get_file_section
from .tag import get_user_file_tags
from .utils import extract_title


async def get_user(user_id: int, db: AsyncSession):
    """Retrieve a user by ID, excluding soft-deleted users.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to retrieve.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    User or None
        The user object if found and not deleted, None otherwise.
    """
    result: Result[Any] = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    return result.scalars().first()


async def create_user(name: str, initials: str, email: str, password_hash: str, db: AsyncSession):
    """Create a new user with default settings.

    Parameters
    ----------
    name : str
        Full name of the user.
    initials : str
        User initials. If empty, will be generated from first letters of name words.
    email : str
        Unique email address for the user.
    password_hash : str
        Bcrypt-hashed password.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    User
        The newly created user object with default file settings.

    Notes
    -----
    Creates default FileSettings for the user with standard display preferences.
    The function commits the transaction and refreshes the user object before returning.
    """
    if not initials:
        initials = "".join([w[0].upper() for w in name.split()])

    user = User(name=name, initials=initials, email=email, password_hash=password_hash)
    db.add(user)
    await db.flush()  # Flush to get the user.id without committing

    # Create default settings for the new user
    default_settings = FileSettings(
        file_id=None,  # NULL for default settings
        user_id=user.id,
        background="var(--surface-page)",
        font_size="16px",
        line_height="1.5",
        font_family="Source Sans 3",
        margin_width="16px",
        columns=1,
    )
    db.add(default_settings)

    await db.commit()
    await db.refresh(user)
    return user


async def update_user(user_id: int, name: str, initials: str, email: str, db: AsyncSession):
    """Update user information.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to update.
    name : str
        New full name for the user.
    initials : str
        New initials for the user.
    email : str
        New email address for the user.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    User or None
        The updated user object if found, None if user doesn't exist.

    Notes
    -----
    Only updates fields that have changed from their current values.
    Commits the transaction and refreshes the user object before returning.
    """
    user = await get_user(user_id, db)
    if not user:
        return None
    if name != user.name:
        user.name = name
    if initials != user.initials:
        user.initials = initials
    if email != user.email:
        user.email = email
    await db.commit()
    await db.refresh(user)
    return user


async def soft_delete_user(user_id: int, db: AsyncSession):
    """Soft delete a user by setting deleted_at timestamp.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user to delete.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    User or None
        The soft-deleted user object if found, None if user doesn't exist.

    Notes
    -----
    Sets the deleted_at field to current UTC timestamp instead of actually
    deleting the record. This preserves data integrity and allows for recovery.
    """
    user = await get_user(user_id, db)
    if not user:
        return None
    user.deleted_at = datetime.now(UTC)
    await db.commit()
    return user


async def get_user_files(user_id: int, with_tags: bool, db: AsyncSession):
    """Retrieve all files accessible by a user (owned or shared) with optional tag information.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user whose files to retrieve.
    with_tags : bool
        Whether to include tag information for each file.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    list of dict
        List of file dictionaries containing id, title, source, last_edited_at,
        role, and tags (if with_tags=True).

    Raises
    ------
    ValueError
        If the user is not found.

    Notes
    -----
    Files are ordered by role (OWNER > EDITOR > COMMENTER), then by last edited date (descending).
    Titles are extracted asynchronously from RSM content using extract_title.
    Tags are fetched concurrently if requested to optimize performance.
    Includes all files where user has any permission level.
    """
    user = await get_user(user_id, db)
    if not user:
        raise ValueError(f"User {user_id} not found")

    role_order = case(
        (FilePermission.role == FileRole.OWNER, 1),
        (FilePermission.role == FileRole.EDITOR, 2),
        (FilePermission.role == FileRole.COMMENTER, 3),
        else_=4
    )

    result: Result[Any] = await db.execute(
        select(File, FilePermission.role)
        .join(FilePermission, File.id == FilePermission.file_id)
        .where(
            FilePermission.user_id == user_id,
            File.deleted_at.is_(None),
            FilePermission.deleted_at.is_(None),
        )
        .order_by(role_order, desc(File.last_edited_at))
    )
    rows = result.all()
    docs_with_roles = [(row[0], row[1]) for row in rows]

    docs = [doc for doc, _ in docs_with_roles]
    roles = {doc: role for doc, role in docs_with_roles}

    titles_list = await asyncio.gather(*(extract_title(d) for d in docs))
    titles = dict(zip(docs, titles_list))

    tags: dict[Any, Any] = {}
    if with_tags:
        tags_list = await asyncio.gather(*(get_user_file_tags(user_id, d.id, db) for d in docs))
        tags = dict(zip(docs, tags_list))

    return [
        {
            "id": doc.id,
            "title": titles[doc],
            "source": doc.source,
            "last_edited_at": doc.last_edited_at,
            "role": roles[doc].value,
            "tags": tags.get(doc, []),
        }
        for doc in docs
    ]


async def get_user_file(
    user_id: int, file_id: int, with_tags: bool, with_minimap: bool, db: AsyncSession
):
    """Retrieve a specific file owned by a user with optional metadata.

    Parameters
    ----------
    user_id : int
        The unique identifier of the user who owns the file.
    file_id : int
        The unique identifier of the file to retrieve.
    with_tags : bool
        Whether to include tag information for the file.
    with_minimap : bool
        Whether to include minimap section content.
    db : AsyncSession
        SQLAlchemy async database session.

    Returns
    -------
    dict
        File dictionary containing id, title, source, last_edited_at, tags,
        and minimap (if requested).

    Raises
    ------
    ValueError
        If the user or file is not found.

    Notes
    -----
    Validates that both user and file exist before processing.
    Title is extracted from RSM content and minimap is retrieved from
    file sections if requested.
    """
    user = await get_user(user_id, db)
    if not user:
        raise ValueError(f"User {user_id} not found")

    doc = await get_file(file_id, db)
    if not doc:
        raise ValueError(f"File {file_id} not found")

    title = await extract_title(doc)
    tags = (await get_user_file_tags(user_id, file_id, db)) if with_tags else []
    minimap = (await get_file_section(file_id, "minimap", db)) if with_minimap else ""

    return {
        "id": doc.id,
        "title": title,
        "source": doc.source,
        "last_edited_at": doc.last_edited_at,
        "tags": tags,
        "minimap": str(minimap),
    }
