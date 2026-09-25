"""Asset resolver service for RSM rendering.

This module provides asset resolution for RSM rendering by fetching assets
from the database instead of the filesystem.
"""

import base64
import binascii
import logging
from typing import Optional

from rsm.asset_resolver import AssetResolver
from sqlalchemy.ext.asyncio import AsyncSession

from ..asset_signing import compute_content_hash, sign_asset_path
from ..config import settings
from ..models.models import FileAsset


logger = logging.getLogger(__name__)


class FileAssetResolver(AssetResolver):
    """Asset resolver that serves assets from the database.

    In URL mode (default), returns URL paths for the browser to fetch.
    In standalone mode, returns raw content for base64 inlining.
    """

    def __init__(self, assets: dict[str, tuple], file_id: int = 0, standalone: bool = False):
        self._assets = assets
        self._file_id = file_id
        self._standalone = standalone

    def resolve_asset(self, path: str) -> Optional[str | bytes]:
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

        content: str = asset_info[0]
        encoding: str = asset_info[1]
        # content_hash is present for rows loaded from the DB; a directly
        # constructed resolver or a legacy row without it falls back to hashing.
        content_hash: str | None = asset_info[2] if len(asset_info) > 2 else None

        # Only return URL paths for image assets — HTML content must always
        # be inlined since there's no browser-native way to embed HTML by URL.
        is_image = any(path.lower().endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"))
        if not self._standalone and is_image:
            # Absolute (frontend and backend are different origins in prod, so a
            # root-relative path would resolve against the frontend and 404) and
            # signed (a plain <img> cannot send a bearer token, so the HMAC is what
            # authorizes the fetch). Signed here, downstream of the VIEW check the
            # caller already passed to reach rendering. The content hash makes the
            # signed URL cache-stable across renders (std-do5t); hash on the fly
            # only for a legacy row that predates the stored column.
            if not content_hash:
                content_hash = compute_content_hash(content, encoding)
            query = sign_asset_path(self._file_id, path, content_hash)
            return f"{settings.BACKEND_URL}/files/{self._file_id}/assets/raw/{path}?{query}"

        if encoding == "base64":
            try:
                data = base64.b64decode(content)
                try:
                    return data.decode('utf-8')
                except UnicodeDecodeError:
                    return data
            except binascii.Error as e:
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
            
            # Create assets dictionary with content, encoding, and stored hash
            assets_dict: dict[str, tuple[str, str, str | None]] = {}
            for asset in assets:
                try:
                    # Store content, encoding, and the stored content hash as a tuple.
                    # The hash lets the resolver mint a cache-stable URL without
                    # rehashing the bytes on every render (std-do5t).
                    content = str(asset.content)
                    encoding = getattr(asset, 'content_encoding', 'plain')  # Default to plain for backward compatibility
                    content_hash = getattr(asset, 'content_hash', None)
                    assets_dict[str(asset.filename)] = (content, encoding, content_hash)
                    logger.info(f"Loaded asset {asset.filename} ({encoding}): {len(content)} chars")
                except (AttributeError, TypeError, ValueError) as e:
                    logger.error(f"Failed to load asset {asset.filename} for file {file_id}: {e}")
                    # Skip this asset if loading fails
                    continue
            
            logger.info(f"Loaded {len(assets_dict)} assets for file {file_id}")
            
            return cls(assets_dict, file_id=file_id)
            
        except (RuntimeError, OSError) as e:
            logger.error(f"Failed to load assets for file {file_id}: {e}")
            return cls({})