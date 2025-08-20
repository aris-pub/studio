"""In-memory file service implementation."""

import asyncio
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional, Set

import rsm
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from ...logging_config import get_logger
from ...models.models import File as DbFile
from .interface import FileServiceInterface
from .models import FileCreateData, FileData, FileUpdateData


logger = get_logger(__name__)


class InMemoryFileService(FileServiceInterface):
    """In-memory implementation of file service."""
    
    def __init__(self):
        """Initialize the in-memory file service."""
        self._files: Dict[int, FileData] = {}
        self._user_files: Dict[int, Set[int]] = {}  # user_id -> file_ids
        self._next_id: int = 1
        self._lock = asyncio.Lock()
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize the service."""
        async with self._lock:
            if not self._initialized:
                logger.debug("Initializing InMemoryFileService")
                self._initialized = True
    
    async def get_file(self, file_id: int) -> Optional[FileData]:
        """Get a single file by ID."""
        async with self._lock:
            file_data = self._files.get(file_id)
            if file_data and not file_data.is_deleted():
                return file_data
            return None
    
    async def get_user_files(self, user_id: int) -> List[FileData]:
        """Get all files owned by a specific user."""
        async with self._lock:
            file_ids = self._user_files.get(user_id, set())
            files = []
            for file_id in file_ids:
                file_data = self._files.get(file_id)
                if file_data and not file_data.is_deleted():
                    files.append(file_data)
            return files
    
    async def get_all_files(self) -> List[FileData]:
        """Get all files in the system."""
        async with self._lock:
            return [
                file_data for file_data in self._files.values()
                if not file_data.is_deleted()
            ]
    
    async def create_file(self, data: FileCreateData) -> FileData:
        """Create a new file."""
        async with self._lock:
            now = datetime.now(UTC)
            
            # Create new file with auto-incrementing ID
            file_data = FileData(
                id=self._next_id,
                title=data.title,
                abstract=data.abstract,
                source=data.source,
                owner_id=data.owner_id,
                status=data.status,
                created_at=now,
                last_edited_at=now,
                deleted_at=None
            )
            
            # Store in memory
            self._files[self._next_id] = file_data
            
            # Update user index
            if data.owner_id not in self._user_files:
                self._user_files[data.owner_id] = set()
            self._user_files[data.owner_id].add(self._next_id)
            
            # Increment ID for next file
            self._next_id += 1
            
            logger.debug(f"Created file {file_data.id} for user {data.owner_id}")
            return file_data
    
    async def update_file(self, file_id: int, updates: FileUpdateData) -> Optional[FileData]:
        """Update an existing file."""
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data or file_data.is_deleted():
                return None
            
            if not updates.has_updates():
                return file_data
            
            # Update fields that are provided
            if updates.title is not None:
                file_data.title = updates.title
            if updates.abstract is not None:
                file_data.abstract = updates.abstract
            if updates.source is not None:
                file_data.source = updates.source
                # Clear cached values when source changes
                file_data.clear_cache()
            if updates.status is not None:
                file_data.status = updates.status
            
            # Update last edited timestamp
            file_data.last_edited_at = datetime.now(UTC)
            
            logger.debug(f"Updated file {file_id}")
            return file_data
    
    async def delete_file(self, file_id: int) -> bool:
        """Soft delete a file."""
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data or file_data.is_deleted():
                return False
            
            # Soft delete by setting timestamp
            file_data.deleted_at = datetime.now(UTC)
            
            logger.debug(f"Soft deleted file {file_id}")
            return True
    
    async def duplicate_file(self, file_id: int) -> Optional[FileData]:
        """Create a duplicate of an existing file."""
        # First, check if original exists (without holding lock for create_file call)
        async with self._lock:
            original = self._files.get(file_id)
            if not original or original.is_deleted():
                return None
            
            # Create duplicate data
            duplicate_data = FileCreateData(
                title=f"{original.title} (copy)",
                abstract=original.abstract,
                source=original.source,
                owner_id=original.owner_id,
                status=original.status
            )
        
        # Call create_file without holding the lock to avoid deadlock
        return await self.create_file(duplicate_data)
    
    async def get_file_content_structured(self, file_id: int, db: Optional[AsyncSession] = None) -> Optional[dict]:
        """Get structured content for a file's RSM content.
        
        Parameters
        ----------
        file_id : int
            The ID of the file to render
        db : AsyncSession, optional
            Database session for asset resolution. If provided, will use FileAssetResolver
            to load assets from database for RSM rendering.
            
        Returns
        -------
        Optional[dict]
            Structured content with keys: head, body, init_script, or None if file not found
        """
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data or file_data.is_deleted():
                return None
            
            # Generate cache key based on whether we have database assets
            cache_key = "structured_with_assets" if db is not None else "structured_no_assets"
            
            # Check cache first - use different cache for asset vs non-asset rendering
            cached_content: Optional[dict] = getattr(file_data, f'_rendered_{cache_key}', None)
            if cached_content is not None:
                return cached_content
            
            # Render using RSM make with structured output
            try:
                if db is not None:
                    from ..asset_resolver import FileAssetResolver
                    asset_resolver = await FileAssetResolver.create_for_file(file_id, db)
                    rendered_content = await asyncio.to_thread(rsm.make, file_data.source, handrails=True, asset_resolver=asset_resolver, structured=True)
                else:
                    rendered_content = await asyncio.to_thread(rsm.make, file_data.source, handrails=True, structured=True)
                
                # Ensure it's a dict
                if not isinstance(rendered_content, dict):
                    logger.error(f"Expected dict from RSM structured render, got {type(rendered_content)}")
                    rendered_content = {"head": "", "body": str(rendered_content), "init_script": ""}
                
                # Cache the result
                setattr(file_data, f'_rendered_{cache_key}', rendered_content)
                return rendered_content
            except Exception as e:
                logger.error(f"Failed to render structured RSM content for file {file_id}: {e}")
                # Fallback to placeholder if rendering fails
                fallback_content = {
                    "head": "",
                    "body": f"<p>Rendered: {file_data.source}</p>",
                    "init_script": ""
                }
                setattr(file_data, f'_rendered_{cache_key}', fallback_content)
                return fallback_content

    async def get_file_html(self, file_id: int, db: Optional[AsyncSession] = None) -> Optional[str]:
        """Get rendered HTML for a file's RSM content.
        
        Parameters
        ----------
        file_id : int
            The ID of the file to render
        db : AsyncSession, optional
            Database session for asset resolution. If provided, will use FileAssetResolver
            to load assets from database for RSM rendering.
            
        Returns
        -------
        Optional[str]
            Rendered HTML string, or None if file not found
        """
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data or file_data.is_deleted():
                return None
            
            # Generate cache key based on whether we have database assets
            cache_key = "html_with_assets" if db is not None else "html_no_assets"
            
            # Check cache first - use different cache for asset vs non-asset rendering
            cached_html = getattr(file_data, f'_rendered_{cache_key}', None)
            if cached_html is not None:
                return str(cached_html)
            
            # Render RSM content with or without asset resolution
            try:
                if db is not None:
                    # Render with database asset resolver
                    from ..asset_resolver import FileAssetResolver
                    asset_resolver = await FileAssetResolver.create_for_file(file_id, db)
                    rendered_html = await asyncio.to_thread(rsm.render, file_data.source, handrails=True, asset_resolver=asset_resolver)
                else:
                    # Render without asset resolver (original behavior)
                    rendered_html = await asyncio.to_thread(rsm.render, file_data.source, handrails=True)
                
                rendered_html = str(rendered_html)
                
                # Cache the result
                setattr(file_data, f'_rendered_{cache_key}', rendered_html)
                return rendered_html
            except Exception as e:
                logger.error(f"Failed to render RSM content for file {file_id}: {e}")
                # Fallback to placeholder if rendering fails
                fallback_html: str = f"<p>Rendered: {file_data.source}</p>"
                setattr(file_data, f'_rendered_{cache_key}', fallback_html)
                return fallback_html
    
    async def get_file_section(self, file_id: int, section_name: str, handrails: bool = True) -> Optional[str]:
        """Get rendered HTML for a specific section of a file."""
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data or file_data.is_deleted():
                return None
            
            # Check cache first
            cache_key = f"{section_name}_{handrails}"
            if cache_key in file_data._sections:
                return file_data._sections[cache_key]
            
            # Extract and render section using actual RSM processing
            try:
                # Use RSM ProcessorApp to render the content with sections
                app = rsm.app.ProcessorApp(plain=file_data.source, handrails=handrails)
                await asyncio.to_thread(app.run)
                html = app.translator.body
                
                # Use BeautifulSoup to extract the specific section
                soup = BeautifulSoup(html, "lxml")
                
                # Try to find element by exact class match first
                element = soup.find(attrs={"class": section_name})
                if not element:
                    # Try to find element that contains the section_name in its class list
                    for elem in soup.find_all():
                        if elem.get('class') and section_name in elem.get('class'):
                            element = elem
                            break
                
                section_html = str(element) if element else ""
                
                file_data._sections[cache_key] = section_html
                return section_html
            except Exception as e:
                logger.error(f"Failed to extract section '{section_name}' for file {file_id}: {e}")
                # Fallback to placeholder if extraction fails
                section_html = f"<section>{section_name}: {file_data.source}</section>"
                file_data._sections[cache_key] = section_html
                return section_html
    
    async def get_file_title(self, file_id: int) -> Optional[str]:
        """Get the title for a file, extracted from RSM if needed."""
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data or file_data.is_deleted():
                return None
            
            # If file has an explicit title, use it
            if file_data.title:
                return file_data.title
            
            # Check cache first
            if file_data._extracted_title is not None:
                return file_data._extracted_title
            
            # Extract title from RSM content
            try:
                app = rsm.app.ParserApp(plain=file_data.source)
                await asyncio.to_thread(app.run)
                extracted_title = str(app.transformer.tree.title) if app.transformer.tree.title else ""
                file_data._extracted_title = extracted_title
                return extracted_title
            except Exception as e:
                logger.error(f"Failed to extract title for file {file_id}: {e}")
                # Fallback to empty string
                file_data._extracted_title = ""
                return ""
    
    async def sync_from_database(self, db: AsyncSession) -> None:
        """Load all files from database into memory."""
        if db is None:
            logger.warning("Cannot sync from database: no database session provided")
            return
            
        async with self._lock:
            logger.debug("Syncing files from database to memory")
            
            # Clear existing data
            self._files.clear()
            self._user_files.clear()
            
            # Load all non-deleted files from database
            result: Result[Any] = await db.execute(select(DbFile).where(DbFile.deleted_at.is_(None)))
            db_files = result.scalars().all()
            
            # Convert database files to in-memory format
            max_id = 0
            for db_file in db_files:
                file_data = FileData(
                    id=db_file.id,
                    title=db_file.title or "",
                    abstract=db_file.abstract or "",
                    source=db_file.source or "",
                    owner_id=db_file.owner_id,
                    status=db_file.status,
                    created_at=db_file.created_at,
                    last_edited_at=db_file.last_edited_at,
                    deleted_at=db_file.deleted_at
                )
                
                self._files[db_file.id] = file_data
                
                # Update user index
                if db_file.owner_id not in self._user_files:
                    self._user_files[db_file.owner_id] = set()
                self._user_files[db_file.owner_id].add(db_file.id)
                
                # Track max ID for auto-increment
                max_id = max(max_id, db_file.id)
            
            # Set next ID to be one greater than max existing ID
            self._next_id = max_id + 1
            
            logger.debug(f"Loaded {len(db_files)} files from database")
    
    async def sync_to_database(self, db: AsyncSession) -> None:
        """Save all in-memory files to database."""
        if db is None:
            logger.warning("Cannot sync to database: no database session provided")
            return
            
        async with self._lock:
            logger.debug("Syncing all files from memory to database")
            
            for file_data in self._files.values():
                await self._save_or_update_file_in_db(file_data, db)
            
            await db.commit()
            logger.debug(f"Synced {len(self._files)} files to database")
    
    async def save_file_to_database(self, file_id: int, db: AsyncSession) -> bool:
        """Save a specific file to database."""
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data:
                return False
            
            success = await self._save_or_update_file_in_db(file_data, db)
            if success:
                await db.commit()
                logger.debug(f"Saved file {file_id} to database")
            return success
    
    async def update_file_in_database(self, file_id: int, db: AsyncSession) -> bool:
        """Update a specific file in database."""
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data:
                return False
            
            success = await self._save_or_update_file_in_db(file_data, db)
            if success:
                await db.commit()
                logger.debug(f"Updated file {file_id} in database")
            return success
    
    async def delete_file_in_database(self, file_id: int, db: AsyncSession) -> bool:
        """Soft delete a specific file in database."""
        if db is None:
            return False
            
        async with self._lock:
            file_data = self._files.get(file_id)
            if not file_data or not file_data.is_deleted():
                return False
            
            # Find the database record and soft delete it
            result: Result[Any] = await db.execute(select(DbFile).where(DbFile.id == file_id))
            db_file = result.scalars().first()
            
            if db_file:
                db_file.deleted_at = file_data.deleted_at
                await db.commit()
                logger.debug(f"Soft deleted file {file_id} in database")
                return True
            
            return False
    
    async def _save_or_update_file_in_db(self, file_data: FileData, db: AsyncSession) -> bool:
        """Helper method to save or update a file in the database."""
        if db is None:
            return False
            
        try:
            # Check if file exists in database
            result: Result[Any] = await db.execute(select(DbFile).where(DbFile.id == file_data.id))
            db_file = result.scalars().first()
            
            if db_file:
                # Update existing file
                db_file.title = file_data.title
                db_file.abstract = file_data.abstract
                db_file.source = file_data.source
                db_file.status = file_data.status
                db_file.last_edited_at = file_data.last_edited_at
                db_file.deleted_at = file_data.deleted_at
            else:
                # Create new file
                db_file = DbFile(
                    id=file_data.id,
                    title=file_data.title,
                    abstract=file_data.abstract,
                    source=file_data.source,
                    owner_id=file_data.owner_id,
                    status=file_data.status,
                    created_at=file_data.created_at,
                    last_edited_at=file_data.last_edited_at,
                    deleted_at=file_data.deleted_at
                )
                db.add(db_file)
            
            return True
        except Exception as e:
            logger.error(f"Failed to save file {file_data.id} to database: {e}")
            return False