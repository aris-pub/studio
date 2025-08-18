"""Tests for FileAssetResolver service."""

from sqlalchemy.ext.asyncio import AsyncSession

from aris.models.models import FileAsset
from aris.services.asset_resolver import FileAssetResolver


class TestFileAssetResolver:
    """Test FileAssetResolver functionality."""

    def test_resolver_with_empty_assets(self):
        """Test resolver with no assets."""
        resolver = FileAssetResolver({})
        
        result = resolver.resolve_asset("nonexistent.html")
        assert result is None

    def test_resolver_with_assets(self):
        """Test resolver with pre-loaded assets."""
        assets = {
            "test.html": ("<div>Test HTML</div>", "plain"),
            "style.css": ("body { color: red; }", "plain"),
        }
        resolver = FileAssetResolver(assets)
        
        # Test existing assets
        assert resolver.resolve_asset("test.html") == "<div>Test HTML</div>"
        assert resolver.resolve_asset("style.css") == "body { color: red; }"
        
        # Test non-existent asset
        assert resolver.resolve_asset("missing.js") is None

    async def test_create_for_file_with_assets(self, db_session: AsyncSession):
        """Test creating resolver for file with assets."""
        # Create a file asset in the database
        asset = FileAsset(
            filename="merge_sort_embed.html",
            mime_type="text/html",
            content="<div>Merge Sort Algorithm</div>",
            file_id=2,
            owner_id=1
        )
        db_session.add(asset)
        await db_session.commit()
        
        # Create resolver for the file
        resolver = await FileAssetResolver.create_for_file(2, db_session)
        
        # Test asset resolution
        result = resolver.resolve_asset("merge_sort_embed.html")
        assert result == "<div>Merge Sort Algorithm</div>"
        
        # Test non-existent asset
        assert resolver.resolve_asset("nonexistent.html") is None

    async def test_create_for_file_no_assets(self, db_session: AsyncSession):
        """Test creating resolver for file with no assets."""
        resolver = await FileAssetResolver.create_for_file(999, db_session)
        
        # Should return None for any asset request
        assert resolver.resolve_asset("any.html") is None

    async def test_create_for_file_ignores_deleted_assets(self, db_session: AsyncSession):
        """Test that deleted assets are not included in resolver."""
        from datetime import datetime, timezone
        
        # Create a regular asset
        asset1 = FileAsset(
            filename="active.html",
            mime_type="text/html", 
            content="<div>Active</div>",
            file_id=3,
            owner_id=1
        )
        
        # Create a deleted asset
        asset2 = FileAsset(
            filename="deleted.html",
            mime_type="text/html",
            content="<div>Deleted</div>",
            file_id=3,
            owner_id=1,
            deleted_at=datetime.now(timezone.utc)
        )
        
        db_session.add_all([asset1, asset2])
        await db_session.commit()
        
        # Create resolver
        resolver = await FileAssetResolver.create_for_file(3, db_session)
        
        # Should only find active asset
        assert resolver.resolve_asset("active.html") == "<div>Active</div>"
        assert resolver.resolve_asset("deleted.html") is None

    async def test_create_for_file_multiple_assets(self, db_session: AsyncSession):
        """Test resolver with multiple assets for same file."""
        assets = [
            FileAsset(
                filename="chart.html",
                mime_type="text/html",
                content="<div>Chart</div>",
                file_id=4,
                owner_id=1
            ),
            FileAsset(
                filename="data.json", 
                mime_type="application/json",
                content='{"values": [1, 2, 3]}',
                file_id=4,
                owner_id=1
            ),
            FileAsset(
                filename="style.css",
                mime_type="text/css", 
                content="body { font-family: Arial; }",
                file_id=4,
                owner_id=1
            )
        ]
        
        db_session.add_all(assets)
        await db_session.commit()
        
        resolver = await FileAssetResolver.create_for_file(4, db_session)
        
        # Test all assets are accessible
        assert resolver.resolve_asset("chart.html") == "<div>Chart</div>"
        assert resolver.resolve_asset("data.json") == '{"values": [1, 2, 3]}'
        assert resolver.resolve_asset("style.css") == "body { font-family: Arial; }"
        assert resolver.resolve_asset("missing.txt") is None