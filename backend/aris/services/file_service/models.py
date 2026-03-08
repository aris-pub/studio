"""Data models for file service operations."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional

from ...models.models import FileStatus


@dataclass
class FileData:
    """In-memory representation of a file with caching capabilities."""
    
    id: int
    title: str
    abstract: str
    source: str
    owner_id: int
    status: FileStatus
    created_at: datetime
    last_edited_at: datetime
    deleted_at: Optional[datetime] = None
    
    # Cached computed fields
    _rendered_html: Optional[str] = field(default=None, init=False)
    _sections: Dict[str, str] = field(default_factory=dict, init=False)
    _extracted_title: Optional[str] = field(default=None, init=False)
    
    def is_deleted(self) -> bool:
        """Check if the file is soft deleted."""
        return self.deleted_at is not None
    
    def clear_cache(self) -> None:
        """Clear all cached computed values."""
        self._rendered_html = None
        self._sections.clear()
        self._extracted_title = None
        # Clear dynamically-keyed render caches (e.g. _rendered_structured_with_assets)
        for attr in [k for k in self.__dict__ if k.startswith("_rendered_")]:
            delattr(self, attr)


@dataclass
class FileCreateData:
    """Data for creating a new file."""
    
    title: str
    source: str
    owner_id: int
    abstract: str = ""
    status: FileStatus = FileStatus.DRAFT


@dataclass
class FileUpdateData:
    """Data for updating an existing file."""
    
    title: Optional[str] = None
    abstract: Optional[str] = None
    source: Optional[str] = None
    status: Optional[FileStatus] = None
    
    def has_updates(self) -> bool:
        """Check if this update data contains any updates."""
        return any([
            self.title is not None,
            self.abstract is not None,
            self.source is not None,
            self.status is not None
        ])