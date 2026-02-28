"""Abstract interface for file service implementations.

This interface allows for different storage backends (in-memory, Redis, etc.)
while maintaining consistent API for file operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from .models import FileCreateData, FileData, FileUpdateData


class FileServiceInterface(ABC):
    """Abstract base class for file service implementations."""
    
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the service (load data, connect to storage, etc.)."""
        pass
    
    @abstractmethod
    async def get_file(self, file_id: int) -> Optional[FileData]:
        """Get a single file by ID.
        
        Args:
            file_id: Unique identifier of the file
            
        Returns:
            FileData if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def get_user_files(self, user_id: int) -> List[FileData]:
        """Get all files owned by a specific user.
        
        Args:
            user_id: Unique identifier of the user
            
        Returns:
            List of FileData objects owned by the user
        """
        pass
    
    @abstractmethod
    async def get_all_files(self) -> List[FileData]:
        """Get all files in the system.
        
        Returns:
            List of all FileData objects
        """
        pass
    
    @abstractmethod
    async def create_file(self, data: FileCreateData, db=None) -> FileData:
        """Create a new file.

        Args:
            data: File creation data
            db: Optional database session. When provided, the database assigns
                the ID via autoincrement instead of the in-memory counter.

        Returns:
            Created FileData object with assigned ID
        """
        pass
    
    @abstractmethod
    async def update_file(self, file_id: int, updates: FileUpdateData) -> Optional[FileData]:
        """Update an existing file.
        
        Args:
            file_id: Unique identifier of the file to update
            updates: Data to update
            
        Returns:
            Updated FileData if file exists, None otherwise
        """
        pass
    
    @abstractmethod
    async def delete_file(self, file_id: int) -> bool:
        """Soft delete a file.
        
        Args:
            file_id: Unique identifier of the file to delete
            
        Returns:
            True if file was deleted, False if file not found
        """
        pass
    
    @abstractmethod
    async def duplicate_file(self, file_id: int, db=None) -> Optional[FileData]:
        """Create a duplicate of an existing file.

        Args:
            file_id: Unique identifier of the file to duplicate
            db: Optional database session passed through to create_file

        Returns:
            New FileData object if original exists, None otherwise
        """
        pass
    
    @abstractmethod
    async def get_file_html(self, file_id: int, db=None) -> Optional[str]:
        """Get rendered HTML for a file's RSM content.
        
        Args:
            file_id: Unique identifier of the file
            db: Optional database session for asset resolution
            
        Returns:
            Rendered HTML string if file exists, None otherwise
        """
        pass
    
    @abstractmethod
    async def get_file_section(self, file_id: int, section_name: str, handrails: bool = True) -> Optional[str]:
        """Get rendered HTML for a specific section of a file.
        
        Args:
            file_id: Unique identifier of the file
            section_name: Name of the section to extract
            handrails: Whether to include navigation handrails
            
        Returns:
            Rendered section HTML if file and section exist, None otherwise
        """
        pass
    
    @abstractmethod
    async def get_file_title(self, file_id: int) -> Optional[str]:
        """Get the title for a file, extracted from RSM if needed.
        
        Args:
            file_id: Unique identifier of the file
            
        Returns:
            File title (from title field or extracted from RSM), None if file not found
        """
        pass
    
    @abstractmethod
    async def sync_from_database(self, db) -> None:
        """Load all files from database into memory.
        
        Args:
            db: Database session
        """
        pass
    
    @abstractmethod
    async def sync_to_database(self, db) -> None:
        """Save all in-memory files to database.
        
        Args:
            db: Database session
        """
        pass
    
    @abstractmethod
    async def save_file_to_database(self, file_id: int, db) -> bool:
        """Save a specific file to database.
        
        Args:
            file_id: Unique identifier of the file
            db: Database session
            
        Returns:
            True if saved successfully, False otherwise
        """
        pass
    
    @abstractmethod
    async def update_file_in_database(self, file_id: int, db) -> bool:
        """Update a specific file in database.
        
        Args:
            file_id: Unique identifier of the file
            db: Database session
            
        Returns:
            True if updated successfully, False otherwise
        """
        pass
    
    @abstractmethod
    async def delete_file_in_database(self, file_id: int, db) -> bool:
        """Soft delete a specific file in database.
        
        Args:
            file_id: Unique identifier of the file
            db: Database session
            
        Returns:
            True if deleted successfully, False otherwise
        """
        pass