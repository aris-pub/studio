"""Tests for FileAssetResolver service."""

from datetime import datetime, timezone

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

    async def test_create_for_file_with_assets(self, db_session: AsyncSession, test_file):
        """Test creating resolver for file with assets."""
        asset = FileAsset(
            filename="merge_sort_embed.html",
            mime_type="text/html",
            content="<div>Merge Sort Algorithm</div>",
            file_id=test_file.id,
            owner_id=test_file.owner_id
        )
        db_session.add(asset)
        await db_session.commit()

        resolver = await FileAssetResolver.create_for_file(test_file.id, db_session)

        assert resolver.resolve_asset("merge_sort_embed.html") == "<div>Merge Sort Algorithm</div>"
        assert resolver.resolve_asset("nonexistent.html") is None

    async def test_create_for_file_no_assets(self, db_session: AsyncSession):
        """Test creating resolver for file with no assets."""
        resolver = await FileAssetResolver.create_for_file(999, db_session)

        assert resolver.resolve_asset("any.html") is None

    async def test_create_for_file_ignores_deleted_assets(self, db_session: AsyncSession, test_file):
        """Test that deleted assets are not included in resolver."""
        asset1 = FileAsset(
            filename="active.html",
            mime_type="text/html",
            content="<div>Active</div>",
            file_id=test_file.id,
            owner_id=test_file.owner_id
        )

        asset2 = FileAsset(
            filename="deleted.html",
            mime_type="text/html",
            content="<div>Deleted</div>",
            file_id=test_file.id,
            owner_id=test_file.owner_id,
            deleted_at=datetime.now(timezone.utc)
        )

        db_session.add_all([asset1, asset2])
        await db_session.commit()

        resolver = await FileAssetResolver.create_for_file(test_file.id, db_session)

        assert resolver.resolve_asset("active.html") == "<div>Active</div>"
        assert resolver.resolve_asset("deleted.html") is None

    async def test_create_for_file_multiple_assets(self, db_session: AsyncSession, test_file):
        """Test resolver with multiple assets for same file."""
        assets = [
            FileAsset(
                filename="chart.html",
                mime_type="text/html",
                content="<div>Chart</div>",
                file_id=test_file.id,
                owner_id=test_file.owner_id
            ),
            FileAsset(
                filename="data.json",
                mime_type="application/json",
                content='{"values": [1, 2, 3]}',
                file_id=test_file.id,
                owner_id=test_file.owner_id
            ),
            FileAsset(
                filename="style.css",
                mime_type="text/css",
                content="body { font-family: Arial; }",
                file_id=test_file.id,
                owner_id=test_file.owner_id
            )
        ]

        db_session.add_all(assets)
        await db_session.commit()

        resolver = await FileAssetResolver.create_for_file(test_file.id, db_session)

        assert resolver.resolve_asset("chart.html") == "<div>Chart</div>"
        assert resolver.resolve_asset("data.json") == '{"values": [1, 2, 3]}'
        assert resolver.resolve_asset("style.css") == "body { font-family: Arial; }"
        assert resolver.resolve_asset("missing.txt") is None
