import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import case, delete, desc, or_, select, update
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import File, FileSettings, User
from ..models.models import (
    Annotation,
    AnnotationMessage,
    FileAsset,
    FilePermission,
    FileRole,
    FileVersion,
    ProfilePicture,
    Signup,
    Tag,
    UserSettings,
)
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
    import logging

    logger = logging.getLogger("aris.crud.user")
    logger.info(f"[get_user] Querying for user_id={user_id}")
    logger.info(f"[get_user] DB session: {db}, in_transaction: {db.in_transaction()}")

    result: Result[Any] = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalars().first()

    logger.info(f"[get_user] Result: {user}")
    if user:
        logger.info(
            f"[get_user] Found user: id={user.id}, email={user.email}, deleted_at={user.deleted_at}"
        )
    else:
        logger.warning(f"[get_user] User {user_id} not found in database")
        # Query without deleted_at check to see if user exists but is deleted
        check_result = await db.execute(select(User).where(User.id == user_id))
        check_user = check_result.scalars().first()
        if check_user:
            logger.warning(
                f"[get_user] User {user_id} exists but is DELETED: deleted_at={check_user.deleted_at}"
            )
        else:
            logger.warning(f"[get_user] User {user_id} does not exist at all in database")

    return user


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
    GDPR right-to-erasure. Marking only the user row would leave the account's
    files, assets, annotations, settings, tags and permissions in the database,
    so this cascades the deleted_at timestamp across every table that holds the
    user's data. The account's data is thereby removed from the application
    immediately (queries filter on deleted_at); a separate scheduled job then
    hard-deletes rows once deleted_at has aged past the retention window.

    Auth is stateless JWT with no server-side token store, so no explicit
    logout is needed: once the user row is soft-deleted, get_user returns None
    and the account's next authenticated request is rejected.

    feedback and reaction rows have no deleted_at column; their user_id/owner_id
    foreign keys are ON DELETE CASCADE, so they are removed by the hard-delete
    job when the user row is finally purged, not here.

    The waitlist signup (keyed by email, not FK-linked to the user and with no
    deleted_at column) is hard-deleted here: the hard-delete job would never
    reach it, and erasing it immediately is the correct behaviour for it.
    """
    user = await get_user(user_id, db)
    if not user:
        return None
    now = datetime.now(UTC)

    # Evaluated per-statement below; the File rows are soft-deleted last, so
    # these still resolve the account's files (this filters by owner, not by
    # deleted_at) while cascading to their file-scoped children.
    owned_files = select(File.id).where(File.owner_id == user_id).scalar_subquery()

    cascades = [
        update(UserSettings).where(UserSettings.user_id == user_id),
        update(Tag).where(Tag.user_id == user_id),
        # Assets and versions are file-scoped, so they cascade with the
        # account's own files. Assets the user uploaded onto other people's
        # files are meant to survive (owner_id is ON DELETE SET NULL,
        # attribution only), so they are deliberately not matched by uploader.
        update(FileAsset).where(FileAsset.file_id.in_(owned_files)),
        update(FileVersion).where(FileVersion.file_id.in_(owned_files)),
        update(FileSettings).where(
            or_(FileSettings.user_id == user_id, FileSettings.file_id.in_(owned_files))
        ),
        update(Annotation).where(
            or_(Annotation.owner_id == user_id, Annotation.file_id.in_(owned_files))
        ),
        update(AnnotationMessage).where(AnnotationMessage.owner_id == user_id),
        update(FilePermission).where(
            or_(FilePermission.user_id == user_id, FilePermission.file_id.in_(owned_files))
        ),
        update(File).where(File.owner_id == user_id),
    ]
    for stmt in cascades:
        await db.execute(stmt.values(deleted_at=now))

    if user.profile_picture_id:
        await db.execute(
            update(ProfilePicture)
            .where(ProfilePicture.id == user.profile_picture_id)
            .values(deleted_at=now)
        )

    await db.execute(delete(Signup).where(Signup.email == user.email))

    user.deleted_at = now
    await db.commit()
    return user


async def hard_delete_expired_users(
    db: AsyncSession, retention_days: int = 30
) -> dict[str, int]:
    """Permanently delete accounts soft-deleted more than retention_days ago.

    This is the second half of the GDPR deletion path: soft delete removes an
    account's data from the application immediately, and this retention job then
    erases it for good once the grace period has passed.

    It relies on database-level ON DELETE cascades (see the
    user_deletion_cascades migration): deleting a users row transitively removes
    the account's files and everything hanging off them, while attribution-only
    references on other users' files (file_versions.created_by,
    file_permissions.granted_by, file_assets.owner_id) are set to NULL so those
    contributions survive. Profile pictures are referenced *by* the users row, so
    they are cleaned up in a second statement once the referencing users are gone.

    Runs on PostgreSQL in production; the cascade is a no-op on SQLite (which does
    not enforce foreign keys). Returns the row count deleted per table.
    """
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)

    users_deleted = await db.execute(
        delete(User).where(User.deleted_at.isnot(None), User.deleted_at < cutoff)
    )
    pictures_deleted = await db.execute(
        delete(ProfilePicture).where(
            ProfilePicture.deleted_at.isnot(None), ProfilePicture.deleted_at < cutoff
        )
    )
    await db.commit()
    return {
        "users": users_deleted.rowcount,
        "profile_pictures": pictures_deleted.rowcount,
    }


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
    import logging

    logger = logging.getLogger("aris.crud.user")
    logger.info(f"[get_user_files] Called for user_id={user_id}, with_tags={with_tags}")
    logger.info(f"[get_user_files] DB session: {db}, in_transaction: {db.in_transaction()}")

    user = await get_user(user_id, db)
    if not user:
        logger.error(f"[get_user_files] User {user_id} not found, raising ValueError")
        raise ValueError(f"User {user_id} not found")

    logger.info(f"[get_user_files] User found: id={user.id}, email={user.email}")

    role_order = case(
        (FilePermission.role == FileRole.OWNER, 1),
        (FilePermission.role == FileRole.EDITOR, 2),
        (FilePermission.role == FileRole.COMMENTER, 3),
        else_=4,
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
        tags_list = []
        for d in docs:
            file_tags = await get_user_file_tags(user_id, d.id, db)
            tags_list.append(file_tags)
        tags = dict(zip(docs, tags_list))

    # Batch-load collaborators for all files in a single query
    collaborators_by_file: dict[int, list[dict]] = {doc.id: [] for doc in docs}
    if docs:
        file_ids = [doc.id for doc in docs]
        collab_stmt = (
            select(
                FilePermission.file_id,
                User.id,
                User.name,
                User.email,
                User.avatar_color,
                FilePermission.role,
            )
            .join(User, FilePermission.user_id == User.id)
            .where(
                FilePermission.file_id.in_(file_ids),
                FilePermission.deleted_at.is_(None),
                FilePermission.user_id != user_id,
            )
        )
        collab_result = await db.execute(collab_stmt)
        for row in collab_result.all():
            collaborators_by_file[row[0]].append(
                {
                    "id": row[1],
                    "name": row[2],
                    "email": row[3],
                    "avatar_color": row[4].value if hasattr(row[4], "value") else row[4],
                    "role": row[5].value,
                }
            )

    # Batch-load reactions for all files
    reactions_by_file: dict[int, list[dict]] = {doc.id: [] for doc in docs}
    if docs:
        from ..models.models import Reaction

        rxn_stmt = select(Reaction.file_id, Reaction.node_id, Reaction.reaction_type).where(
            Reaction.file_id.in_(file_ids)
        )
        rxn_result = await db.execute(rxn_stmt)
        for row in rxn_result.all():
            reactions_by_file[row[0]].append(
                {
                    "node_id": row[1],
                    "reaction_type": row[2],
                }
            )

    return [
        {
            "id": doc.id,
            "title": titles[doc],
            "abstract": doc.abstract or "",
            "keywords": doc.keywords or "",
            "source": doc.source,
            "last_edited_at": doc.last_edited_at,
            "role": roles[doc].value,
            "tags": tags.get(doc, []),
            "collaborators": collaborators_by_file.get(doc.id, []),
            "reactions": reactions_by_file.get(doc.id, []),
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
