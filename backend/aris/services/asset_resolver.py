"""Asset resolver service for RSM rendering.

This module provides asset resolution for RSM rendering by fetching assets
from the database instead of the filesystem.
"""

import base64
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.models import FileAsset


logger = logging.getLogger(__name__)


class FileAssetResolver:
    """Simple asset resolver that fetches assets from the database.
    
    This resolver loads all assets for a given file_id upfront and provides
    synchronous access to them.
    """
    
    def __init__(self, assets: dict[str, tuple[str, str]]):
        """Initialize resolver with pre-loaded assets.
        
        Parameters
        ----------
        assets
            Dictionary mapping asset filenames to (content, encoding) tuples
        """
        self._assets = assets
        
    def resolve_asset(self, path: str) -> Optional[str]:
        """Resolve an asset path to its content.
        
        Parameters
        ----------
        path
            The filename of the asset to resolve
            
        Returns
        -------
        Optional[str]
            The asset content as a string, or None if not found
        """
        asset_info = self._assets.get(path)
        if not asset_info:
            return None
            
        content, encoding = asset_info
        if encoding == "base64":
            try:
                return base64.b64decode(content).decode('utf-8')
            except Exception as e:
                logger.error(f"Failed to decode base64 asset {path}: {e}")
                return None
        else:  # plain
            return content
    
    @classmethod
    async def create_for_file(cls, file_id: int, db: AsyncSession) -> 'FileAssetResolver':
        """Create an asset resolver for a specific file.
        
        Parameters
        ----------
        file_id
            The ID of the file whose assets should be resolved
        db
            Database session for querying assets
            
        Returns
        -------
        FileAssetResolver
            Resolver with all assets pre-loaded
        """
        try:
            # Query all assets for this file
            from sqlalchemy import select
            result = await db.execute(
                select(FileAsset)
                .where(FileAsset.file_id == file_id)
                .where(FileAsset.deleted_at.is_(None))
            )
            assets = result.scalars().all()
            
            # Create assets dictionary with content and encoding
            assets_dict: dict[str, tuple[str, str]] = {}
            for asset in assets:
                try:
                    # Store content and encoding as tuple
                    content = str(asset.content)
                    encoding = getattr(asset, 'content_encoding', 'plain')  # Default to plain for backward compatibility
                    assets_dict[str(asset.filename)] = (content, encoding)
                    logger.info(f"Loaded asset {asset.filename} ({encoding}): {len(content)} chars")
                except Exception as e:
                    logger.error(f"Failed to load asset {asset.filename} for file {file_id}: {e}")
                    # Skip this asset if loading fails
                    continue
            
            logger.info(f"Loaded {len(assets_dict)} assets for file {file_id}")
            
            return cls(assets_dict)
            
        except Exception as e:
            logger.error(f"Failed to load assets for file {file_id}: {e}")
            return cls({})