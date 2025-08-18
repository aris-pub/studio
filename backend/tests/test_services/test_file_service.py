"""Tests for file service models and functionality."""

from datetime import UTC, datetime

import pytest

from aris.models.models import FileStatus
from aris.services.file_service.memory_service import InMemoryFileService
from aris.services.file_service.models import FileCreateData, FileData, FileUpdateData


class TestFileData:
    """Test the FileData model."""
    
    def test_file_data_creation(self):
        """Test creating a FileData instance with all fields."""
        now = datetime.now(UTC)
        
        file_data = FileData(
            id=1,
            title="Test File",
            abstract="Test abstract",
            source=":rsm:\nTest content\n::",
            owner_id=123,
            status=FileStatus.DRAFT,
            created_at=now,
            last_edited_at=now,
            deleted_at=None
        )
        
        assert file_data.id == 1
        assert file_data.title == "Test File"
        assert file_data.abstract == "Test abstract"
        assert file_data.source == ":rsm:\nTest content\n::"
        assert file_data.owner_id == 123
        assert file_data.status == FileStatus.DRAFT
        assert file_data.created_at == now
        assert file_data.last_edited_at == now
        assert file_data.deleted_at is None
    
    def test_file_data_extracted_title_caching(self):
        """Test that extracted title is cached properly."""
        file_data = FileData(
            id=1,
            title="",
            abstract="",
            source=":rsm:\n# Main Title\nContent\n::",
            owner_id=123,
            status=FileStatus.DRAFT,
            created_at=datetime.now(UTC),
            last_edited_at=datetime.now(UTC),
            deleted_at=None
        )
        
        # Initially no cached title
        assert file_data._extracted_title is None
        
        # Set cached title
        file_data._extracted_title = "Main Title"
        assert file_data._extracted_title == "Main Title"
    
    def test_file_data_html_caching(self):
        """Test that rendered HTML is cached properly."""
        file_data = FileData(
            id=1,
            title="Test",
            abstract="",
            source=":rsm:\nTest content\n::",
            owner_id=123,
            status=FileStatus.DRAFT,
            created_at=datetime.now(UTC),
            last_edited_at=datetime.now(UTC),
            deleted_at=None
        )
        
        # Initially no cached HTML
        assert file_data._rendered_html is None
        
        # Set cached HTML
        file_data._rendered_html = "<p>Test content</p>"
        assert file_data._rendered_html == "<p>Test content</p>"
    
    def test_file_data_sections_caching(self):
        """Test that rendered sections are cached properly."""
        file_data = FileData(
            id=1,
            title="Test",
            abstract="",
            source=":rsm:\nTest content\n::",
            owner_id=123,
            status=FileStatus.DRAFT,
            created_at=datetime.now(UTC),
            last_edited_at=datetime.now(UTC),
            deleted_at=None
        )
        
        # Initially no cached sections
        assert len(file_data._sections) == 0
        
        # Cache a section
        file_data._sections["abstract"] = "<p>Abstract content</p>"
        assert file_data._sections["abstract"] == "<p>Abstract content</p>"
    
    def test_file_data_is_deleted(self):
        """Test soft delete functionality."""
        now = datetime.now(UTC)
        
        # Not deleted
        file_data = FileData(
            id=1,
            title="Test",
            abstract="",
            source=":rsm:\nTest\n::",
            owner_id=123,
            status=FileStatus.DRAFT,
            created_at=now,
            last_edited_at=now,
            deleted_at=None
        )
        assert not file_data.is_deleted()
        
        # Deleted
        file_data.deleted_at = now
        assert file_data.is_deleted()


class TestFileCreateData:
    """Test the FileCreateData model."""
    
    def test_file_create_data_required_fields(self):
        """Test creating FileCreateData with required fields."""
        create_data = FileCreateData(
            title="New File",
            source=":rsm:\nNew content\n::",
            owner_id=456
        )
        
        assert create_data.title == "New File"
        assert create_data.source == ":rsm:\nNew content\n::"
        assert create_data.owner_id == 456
        assert create_data.abstract == ""
        assert create_data.status == FileStatus.DRAFT
    
    def test_file_create_data_all_fields(self):
        """Test creating FileCreateData with all fields."""
        create_data = FileCreateData(
            title="New File",
            abstract="File abstract",
            source=":rsm:\nNew content\n::",
            owner_id=456,
            status=FileStatus.DRAFT
        )
        
        assert create_data.title == "New File"
        assert create_data.abstract == "File abstract"
        assert create_data.source == ":rsm:\nNew content\n::"
        assert create_data.owner_id == 456
        assert create_data.status == FileStatus.DRAFT


class TestFileUpdateData:
    """Test the FileUpdateData model."""
    
    def test_file_update_data_partial_update(self):
        """Test creating FileUpdateData with partial updates."""
        update_data = FileUpdateData(
            title="Updated Title"
        )
        
        assert update_data.title == "Updated Title"
        assert update_data.abstract is None
        assert update_data.source is None
        assert update_data.status is None
    
    def test_file_update_data_full_update(self):
        """Test creating FileUpdateData with all fields."""
        update_data = FileUpdateData(
            title="Updated Title",
            abstract="Updated abstract",
            source=":rsm:\nUpdated content\n::",
            status=FileStatus.DRAFT
        )
        
        assert update_data.title == "Updated Title"
        assert update_data.abstract == "Updated abstract"
        assert update_data.source == ":rsm:\nUpdated content\n::"
        assert update_data.status == FileStatus.DRAFT
    
    def test_file_update_data_has_updates(self):
        """Test checking if update data has any updates."""
        # No updates
        empty_update = FileUpdateData()
        assert not empty_update.has_updates()
        
        # Has updates
        update_with_title = FileUpdateData(title="New Title")
        assert update_with_title.has_updates()
        
        update_with_source = FileUpdateData(source=":rsm:\nNew content\n::")
        assert update_with_source.has_updates()


class TestInMemoryFileService:
    """Test the InMemoryFileService implementation."""
    
    @pytest.fixture
    def file_service(self):
        """Create a fresh file service for each test."""
        return InMemoryFileService()
    
    @pytest.fixture
    def sample_create_data(self):
        """Sample file creation data."""
        return FileCreateData(
            title="Sample File",
            abstract="Sample abstract",
            source=":rsm:\nSample content\n::",
            owner_id=123,
            status=FileStatus.DRAFT
        )
    
    @pytest.mark.asyncio
    async def test_create_file(self, file_service, sample_create_data):
        """Test creating a file in memory."""
        await file_service.initialize()
        
        created_file = await file_service.create_file(sample_create_data)
        
        assert created_file.id > 0
        assert created_file.title == "Sample File"
        assert created_file.abstract == "Sample abstract"
        assert created_file.source == ":rsm:\nSample content\n::"
        assert created_file.owner_id == 123
        assert created_file.status == FileStatus.DRAFT
        assert created_file.created_at is not None
        assert created_file.last_edited_at is not None
        assert created_file.deleted_at is None
    
    @pytest.mark.asyncio
    async def test_get_file_by_id(self, file_service, sample_create_data):
        """Test retrieving a file by ID."""
        await file_service.initialize()
        
        created_file = await file_service.create_file(sample_create_data)
        retrieved_file = await file_service.get_file(created_file.id)
        
        assert retrieved_file is not None
        assert retrieved_file.id == created_file.id
        assert retrieved_file.title == created_file.title
        assert retrieved_file.source == created_file.source
    
    @pytest.mark.asyncio
    async def test_get_file_not_found(self, file_service):
        """Test retrieving a non-existent file."""
        await file_service.initialize()
        
        retrieved_file = await file_service.get_file(999)
        
        assert retrieved_file is None
    
    @pytest.mark.asyncio
    async def test_get_user_files(self, file_service):
        """Test retrieving files by user ID."""
        await file_service.initialize()
        
        # Create files for different users
        user1_file = await file_service.create_file(FileCreateData(
            title="User 1 File",
            source=":rsm:\nUser 1 content\n::",
            owner_id=123
        ))
        user2_file = await file_service.create_file(FileCreateData(
            title="User 2 File", 
            source=":rsm:\nUser 2 content\n::",
            owner_id=456
        ))
        
        user1_files = await file_service.get_user_files(123)
        user2_files = await file_service.get_user_files(456)
        
        assert len(user1_files) == 1
        assert user1_files[0].id == user1_file.id
        assert len(user2_files) == 1
        assert user2_files[0].id == user2_file.id
    
    @pytest.mark.asyncio
    async def test_get_all_files(self, file_service):
        """Test retrieving all files."""
        await file_service.initialize()
        
        # Create multiple files
        file1 = await file_service.create_file(FileCreateData(
            title="File 1",
            source=":rsm:\nContent 1\n::",
            owner_id=123
        ))
        file2 = await file_service.create_file(FileCreateData(
            title="File 2",
            source=":rsm:\nContent 2\n::",
            owner_id=456
        ))
        
        all_files = await file_service.get_all_files()
        
        assert len(all_files) == 2
        file_ids = [f.id for f in all_files]
        assert file1.id in file_ids
        assert file2.id in file_ids
    
    @pytest.mark.asyncio
    async def test_update_file(self, file_service, sample_create_data):
        """Test updating a file."""
        await file_service.initialize()
        
        created_file = await file_service.create_file(sample_create_data)
        
        update_data = FileUpdateData(
            title="Updated Title",
            source=":rsm:\nUpdated content\n::"
        )
        
        updated_file = await file_service.update_file(created_file.id, update_data)
        
        assert updated_file is not None
        assert updated_file.id == created_file.id
        assert updated_file.title == "Updated Title"
        assert updated_file.source == ":rsm:\nUpdated content\n::"
        assert updated_file.abstract == sample_create_data.abstract  # unchanged
        assert updated_file.last_edited_at >= created_file.last_edited_at
    
    @pytest.mark.asyncio
    async def test_update_file_not_found(self, file_service):
        """Test updating a non-existent file."""
        await file_service.initialize()
        
        update_data = FileUpdateData(title="New Title")
        updated_file = await file_service.update_file(999, update_data)
        
        assert updated_file is None
    
    @pytest.mark.asyncio
    async def test_delete_file(self, file_service, sample_create_data):
        """Test soft deleting a file."""
        await file_service.initialize()
        
        created_file = await file_service.create_file(sample_create_data)
        
        # File should exist initially
        retrieved_file = await file_service.get_file(created_file.id)
        assert retrieved_file is not None
        
        # Delete the file
        deleted = await file_service.delete_file(created_file.id)
        assert deleted is True
        
        # File should no longer be retrievable (soft deleted)
        retrieved_file = await file_service.get_file(created_file.id)
        assert retrieved_file is None
    
    @pytest.mark.asyncio
    async def test_delete_file_not_found(self, file_service):
        """Test deleting a non-existent file."""
        await file_service.initialize()
        
        deleted = await file_service.delete_file(999)
        assert deleted is False
    
    @pytest.mark.asyncio
    async def test_duplicate_file(self, file_service, sample_create_data):
        """Test duplicating a file."""
        await file_service.initialize()
        
        original_file = await file_service.create_file(sample_create_data)
        duplicated_file = await file_service.duplicate_file(original_file.id)
        
        assert duplicated_file is not None
        assert duplicated_file.id != original_file.id
        assert duplicated_file.title == f"{original_file.title} (copy)"
        assert duplicated_file.source == original_file.source
        assert duplicated_file.owner_id == original_file.owner_id
        assert duplicated_file.status == original_file.status
    
    @pytest.mark.asyncio
    async def test_duplicate_file_not_found(self, file_service):
        """Test duplicating a non-existent file."""
        await file_service.initialize()
        
        duplicated_file = await file_service.duplicate_file(999)
        assert duplicated_file is None
    
    @pytest.mark.asyncio
    async def test_get_file_html_renders_actual_rsm(self, file_service):
        """Test that get_file_html returns properly rendered RSM content, not placeholder."""
        await file_service.initialize()
        
        # Create a file with RSM content
        rsm_content = ":rsm:\n# Test Title\nThis is test content.\n::"
        create_data = FileCreateData(
            title="RSM Test File",
            abstract="Test abstract",
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Get HTML rendering
        html = await file_service.get_file_html(created_file.id)
        
        # Should NOT contain placeholder text
        assert html is not None
        assert "Rendered:" not in html  # Should not contain placeholder prefix
        assert rsm_content not in html  # Should not contain raw RSM source
        
        # Should contain actual HTML elements from RSM rendering
        assert "<" in html and ">" in html  # Should contain HTML tags
        assert "Test Title" in html  # Should contain the rendered title
        assert "This is test content" in html  # Should contain the rendered content
    
    @pytest.mark.asyncio
    async def test_get_file_section_renders_actual_rsm(self, file_service):
        """Test that get_file_section returns properly extracted and rendered RSM sections."""
        await file_service.initialize()
        
        # Create a file with RSM content that has markdown-style sections
        rsm_content = ":rsm:\n# Main Title\n\n## minimap\nMinimap content here\n\n## abstract\nAbstract content here\n::"
        create_data = FileCreateData(
            title="Section Test File",
            abstract="Test abstract",
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Get section rendering - test for level-2 section extraction
        section_html = await file_service.get_file_section(created_file.id, "level-2", handrails=True)
        
        # Should NOT contain placeholder text
        assert section_html is not None
        assert f"level-2: {rsm_content}" not in section_html  # Should not contain placeholder
        
        # Should contain actual section content (should get first level-2 section)
        assert "<" in section_html and ">" in section_html  # Should contain HTML tags
        assert "minimap" in section_html.lower()  # Should contain the first level-2 section content
    
    @pytest.mark.asyncio 
    async def test_html_caching_with_real_rsm(self, file_service):
        """Test that HTML caching works correctly with real RSM rendering."""
        await file_service.initialize()
        
        # Create a file with RSM content
        rsm_content = ":rsm:\n# Cached Title\nCached content.\n::"
        create_data = FileCreateData(
            title="Cache Test File",
            abstract="Test abstract", 
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Get HTML twice - should be cached after first call
        html1 = await file_service.get_file_html(created_file.id)
        html2 = await file_service.get_file_html(created_file.id)
        
        # Both should be identical (cached)
        assert html1 == html2
        
        # Should contain real rendered content, not placeholder
        assert "Rendered:" not in html1
        assert "Cached Title" in html1
        assert "Cached content" in html1
    
    @pytest.mark.asyncio
    async def test_get_file_title_extracts_from_rsm(self, file_service):
        """Test that get_file_title extracts title from RSM when file title is empty."""
        await file_service.initialize()
        
        # Create a file with empty title but RSM content with title
        rsm_content = ":rsm:\n# Extracted Title from RSM\nSome content here\n::"
        create_data = FileCreateData(
            title="",  # Empty title to force extraction
            abstract="Test abstract",
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Get title - should extract from RSM
        title = await file_service.get_file_title(created_file.id)
        
        # Should extract the title from RSM content
        assert title is not None
        assert title == "Extracted Title from RSM"
    
    @pytest.mark.asyncio
    async def test_get_file_title_uses_explicit_title(self, file_service):
        """Test that get_file_title uses explicit title when available."""
        await file_service.initialize()
        
        # Create a file with explicit title and different RSM title
        rsm_content = ":rsm:\n# RSM Title\nSome content here\n::"
        create_data = FileCreateData(
            title="Explicit Title",  # Explicit title should take precedence
            abstract="Test abstract",
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Get title - should use explicit title
        title = await file_service.get_file_title(created_file.id)
        
        # Should use explicit title, not extracted
        assert title == "Explicit Title"
    
    @pytest.mark.asyncio
    async def test_get_file_title_caching(self, file_service):
        """Test that extracted titles are properly cached."""
        await file_service.initialize()
        
        # Create a file with empty title
        rsm_content = ":rsm:\n# Cached Title\nSome content here\n::"
        create_data = FileCreateData(
            title="",
            abstract="Test abstract",
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Get title twice - should be cached after first call
        title1 = await file_service.get_file_title(created_file.id)
        title2 = await file_service.get_file_title(created_file.id)
        
        # Both should be identical (cached)
        assert title1 == title2 == "Cached Title"


class TestInMemoryFileServiceDatabaseSync:
    """Test database synchronization functionality for InMemoryFileService."""
    
    @pytest.fixture
    def file_service(self):
        """Create a fresh file service for each test."""
        return InMemoryFileService()
    
    @pytest.fixture
    def sample_create_data(self):
        """Sample file creation data."""
        return FileCreateData(
            title="Sample File",
            abstract="Sample abstract",
            source=":rsm:\nSample content\n::",
            owner_id=123,
            status=FileStatus.DRAFT
        )
    
    @pytest.mark.asyncio
    async def test_sync_from_database_handles_none_db_session(self, file_service):
        """Test that sync_from_database handles None database session gracefully."""
        await file_service.initialize()
        
        # Should handle None gracefully (would fail with real DB session)
        await file_service.sync_from_database(None)
        
        # Should still have empty state
        all_files = await file_service.get_all_files()
        assert len(all_files) == 0
    
    @pytest.mark.asyncio  
    async def test_sync_to_database_handles_none_db_session(self, file_service, sample_create_data):
        """Test that sync_to_database handles None database session gracefully."""
        await file_service.initialize()
        
        # Create a file in memory
        created_file = await file_service.create_file(sample_create_data)
        
        # Should handle None gracefully (would save with real DB session)
        await file_service.sync_to_database(None)
        
        # File should still exist in memory
        retrieved_file = await file_service.get_file(created_file.id)
        assert retrieved_file is not None
    
    @pytest.mark.asyncio
    async def test_save_file_to_database_returns_false_with_none_session(self, file_service, sample_create_data):
        """Test that save_file_to_database returns False with None database session."""
        await file_service.initialize()
        
        # Create a file in memory
        created_file = await file_service.create_file(sample_create_data)
        
        # Should return False with None session
        result = await file_service.save_file_to_database(created_file.id, None)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_update_file_in_database_returns_false_with_none_session(self, file_service, sample_create_data):
        """Test that update_file_in_database returns False with None database session."""
        await file_service.initialize()
        
        # Create and update a file in memory
        created_file = await file_service.create_file(sample_create_data)
        await file_service.update_file(created_file.id, FileUpdateData(title="Updated Title"))
        
        # Should return False with None session
        result = await file_service.update_file_in_database(created_file.id, None)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_delete_file_in_database_returns_false_with_none_session(self, file_service, sample_create_data):
        """Test that delete_file_in_database returns False with None database session."""
        await file_service.initialize()
        
        # Create and delete a file in memory  
        created_file = await file_service.create_file(sample_create_data)
        await file_service.delete_file(created_file.id)
        
        # Should return False with None session
        result = await file_service.delete_file_in_database(created_file.id, None)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_save_file_to_database_returns_false_for_nonexistent_file(self, file_service):
        """Test that save_file_to_database returns False for nonexistent file."""
        await file_service.initialize()
        
        # Should return False for nonexistent file
        result = await file_service.save_file_to_database(999, None)
        assert result is False


class TestInMemoryFileServiceAssetIntegration:
    """Test asset resolver integration for InMemoryFileService."""
    
    @pytest.fixture
    def file_service(self):
        """Create a fresh file service for each test."""
        return InMemoryFileService()
    
    @pytest.mark.asyncio
    async def test_get_file_html_uses_asset_resolver_when_db_provided(self, file_service):
        """Test that get_file_html integrates with asset resolver when database session is provided."""
        await file_service.initialize()
        
        # Create a file with RSM content that references an HTML asset (like the working tests)
        rsm_content = ":rsm:\n\n:figure:\n  :path: test_figure.html\n\n::\n\n::"
        create_data = FileCreateData(
            title="Asset Test File",
            abstract="Test abstract",
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Mock database session and asset resolver behavior
        from unittest.mock import AsyncMock, MagicMock

        
        # Create mock database session
        mock_db = AsyncMock()
        
        # Create a real database session and asset to test the integration properly
        # Create a real test database asset that the real resolver will find (HTML file)
        # Asset content should be base64 encoded as it's stored in the database
        import base64

        from aris.models.models import FileAsset
        html_content = "<div class='test-asset'>Test Asset Content</div>"
        base64_content = base64.b64encode(html_content.encode('utf-8')).decode('ascii')
        
        test_asset = FileAsset(
            filename="test_figure.html",
            mime_type="text/html",
            content=base64_content,  # Store as base64 like the real system
            file_id=created_file.id,
            owner_id=123
        )
        
        # Mock the database execute call to return our test asset
        from unittest.mock import AsyncMock
        
        # Create proper mock for the database query result
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [test_asset]
        
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        
        # Mock db.execute to return our mock result
        mock_db.execute = AsyncMock(return_value=mock_result)
        
        # Get HTML rendering with database session - should use asset resolver
        html = await file_service.get_file_html(created_file.id, db=mock_db)
        
        # Should contain the resolved asset content embedded in the HTML
        assert html is not None
        assert "Test Asset Content" in html  # Asset content should be embedded
        
        # Verify that the database was actually queried for assets
        mock_db.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_file_html_falls_back_without_db_session(self, file_service):
        """Test that get_file_html falls back to no asset resolver when no database session provided."""
        await file_service.initialize()
        
        # Create a file with RSM content that references an asset
        rsm_content = ":rsm:\n\n:figure:\n  :path: missing-image.png\n\n::\n\n::"
        create_data = FileCreateData(
            title="No Asset Test File", 
            abstract="Test abstract",
            source=rsm_content,
            owner_id=123,
            status=FileStatus.DRAFT
        )
        
        created_file = await file_service.create_file(create_data)
        
        # Get HTML rendering without database session - should fall back gracefully
        html = await file_service.get_file_html(created_file.id)
        
        # Should still render but without asset resolution
        assert html is not None
        assert "missing-image.png" in html  # Original path should remain (no resolution)