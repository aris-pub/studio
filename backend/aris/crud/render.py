import time
from pathlib import Path
from typing import Optional

import rsm
from rsm.asset_resolver import AssetResolver
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging_config import get_logger
from ..services.asset_resolver import FileAssetResolver


logger = get_logger(__name__)


class StaticFileAssetResolver(AssetResolver):
    """Asset resolver that fetches assets from static files on the file system."""
    
    def __init__(self):
        """Initialize resolver."""
        # Use the same RSM static directory resolution as main.py
        self.static_dir = Path(self._find_rsm_static_dir())
    
    def _find_rsm_static_dir(self):
        """Find RSM static directory, works with both PyPI and editable installs."""
        import rsm
        rsm_module_path = Path(rsm.__file__).parent
        static_dir = rsm_module_path / "static"
        if static_dir.exists():
            return str(static_dir)
        
        # Fallback to site-packages if static dir not found
        fallback_dir = Path(".venv/lib/python3.13/site-packages/rsm/static")
        if fallback_dir.exists():
            return str(fallback_dir)
        
        raise RuntimeError(f"RSM static directory not found. Tried: {static_dir}, {fallback_dir}")
        
    def resolve_asset(self, path: str) -> Optional[str]:
        """Resolve an asset path to its content from static files.
        
        Parameters
        ----------
        path
            The filename of the asset to resolve (e.g., "research_metrics_chart.html")
            
        Returns
        -------
        Optional[str]
            The asset content as a string, or None if not found
        """
        try:
            # Construct full path to static file
            asset_path = self.static_dir / path
            
            # Check if file exists and read content
            if asset_path.exists() and asset_path.is_file():
                content = asset_path.read_text(encoding='utf-8')
                logger.info(f"Loaded static asset {path}: {len(content)} chars")
                return content
            else:
                logger.warning(f"Static asset not found: {asset_path}")
                return None
                
        except (OSError, UnicodeDecodeError, PermissionError) as e:
            logger.error(f"Failed to resolve static asset {path}: {e}")
            return None


async def render(src: str):
    """Render RSM source to HTML with static file asset resolution."""
    logger.debug(f"Starting RSM render for {len(src)} characters")
    start_time = time.time()
    
    try:
        # Create static file asset resolver for public endpoint
        asset_resolver = StaticFileAssetResolver()
        result = rsm.render(src, handrails=True, asset_resolver=asset_resolver)
        render_time = time.time() - start_time
        logger.debug(f"RSM render completed successfully in {render_time:.3f}s")
    except rsm.RSMApplicationError as e:
        render_time = time.time() - start_time
        logger.error(f"RSM render failed after {render_time:.3f}s: {e}")
        result = ""
    return result


async def render_with_assets(src: str, file_id: int, db: AsyncSession, user_id: int):
    """Render RSM source to HTML with database asset resolution."""
    logger.debug(f"Starting RSM render with assets for {len(src)} characters, file_id={file_id}")
    start_time = time.time()
    
    try:
        # Create asset resolver for this file with pre-loaded assets
        asset_resolver = await FileAssetResolver.create_for_file(file_id, db)
        
        result = rsm.render(src, handrails=True, asset_resolver=asset_resolver)
        render_time = time.time() - start_time
        logger.debug(f"RSM render with assets completed successfully in {render_time:.3f}s")
    except rsm.RSMApplicationError as e:
        render_time = time.time() - start_time
        logger.error(f"RSM render with assets failed after {render_time:.3f}s: {e}")
        result = ""
    return result
