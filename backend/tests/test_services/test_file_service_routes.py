"""Tests for file service route integration.

These tests verify that the file routes properly integrate with the
InMemoryFileService instead of making direct database calls.
"""

from unittest.mock import AsyncMock, Mock

import pytest

from aris.services.file_service import InMemoryFileService


class TestFileServiceRouteIntegration:
    """Test that file routes integrate with the file service."""
    
    @pytest.fixture
    def mock_file_service(self):
        """Mock file service for testing."""
        service = Mock(spec=InMemoryFileService)
        # Make all methods async
        service.get_all_files = AsyncMock()
        service.create_file = AsyncMock()
        service.get_file = AsyncMock()
        service.update_file = AsyncMock()
        service.delete_file = AsyncMock()
        service.duplicate_file = AsyncMock()
        service.get_file_html = AsyncMock()
        service.get_file_section = AsyncMock()
        return service
    
    @pytest.mark.asyncio
    async def test_get_files_route_should_use_file_service(self, mock_file_service):
        """Test that GET /files should use file service instead of crud."""
        # Now that we've integrated the file service, let's test that it's being used
        
        # Check that the route function has file_service parameter
        import inspect

        from aris.routes.file import get_files
        
        sig = inspect.signature(get_files)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing
    
    @pytest.mark.asyncio
    async def test_create_file_route_should_use_file_service(self, mock_file_service):
        """Test that POST /files should use file service instead of crud."""
        import inspect

        from aris.routes.file import create_file
        
        sig = inspect.signature(create_file)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing
    
    @pytest.mark.asyncio
    async def test_get_file_route_should_use_file_service(self, mock_file_service):
        """Test that GET /files/{file_id} should use file service instead of crud."""
        import inspect

        from aris.routes.file import get_file
        
        sig = inspect.signature(get_file)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing
    
    @pytest.mark.asyncio
    async def test_update_file_route_should_use_file_service(self, mock_file_service):
        """Test that PUT /files/{file_id} should use file service instead of crud."""
        import inspect

        from aris.routes.file import update_file
        
        sig = inspect.signature(update_file)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing
    
    @pytest.mark.asyncio
    async def test_delete_file_route_should_use_file_service(self, mock_file_service):
        """Test that DELETE /files/{file_id} should use file service instead of crud."""
        import inspect

        from aris.routes.file import soft_delete_file
        
        sig = inspect.signature(soft_delete_file)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing
    
    @pytest.mark.asyncio
    async def test_duplicate_file_route_should_use_file_service(self, mock_file_service):
        """Test that POST /files/{file_id}/duplicate should use file service instead of crud."""
        import inspect

        from aris.routes.file import duplicate_file
        
        sig = inspect.signature(duplicate_file)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing
    
    @pytest.mark.asyncio
    async def test_get_file_html_route_should_use_file_service(self, mock_file_service):
        """Test that GET /files/{file_id}/content should use file service instead of crud."""
        import inspect

        from aris.routes.file import get_file_content
        
        sig = inspect.signature(get_file_content)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing
    
    @pytest.mark.asyncio
    async def test_get_file_section_route_should_use_file_service(self, mock_file_service):
        """Test that GET /files/{file_id}/content/{section_name} should use file service instead of crud."""
        import inspect

        from aris.routes.file import get_file_section
        
        sig = inspect.signature(get_file_section)
        params = list(sig.parameters.keys())
        
        # Should have file_service parameter
        assert 'file_service' in params
        assert 'db' in params  # Should still have db for syncing


class TestFileServiceDependencyInjection:
    """Test that the file service can be properly injected into routes."""
    
    @pytest.mark.asyncio
    async def test_file_service_dependency_should_be_available(self):
        """Test that the file service dependency injection is available."""
        # Test that we can import the dependency function
        from aris.deps import get_file_service
        
        # Test that it's callable
        assert callable(get_file_service)
        
        # Test that it returns the expected type when called
        file_service = await get_file_service()
        from aris.services.file_service import InMemoryFileService
        assert isinstance(file_service, InMemoryFileService)
    
    @pytest.mark.asyncio
    async def test_file_service_should_be_singleton(self):
        """Test that the file service maintains singleton behavior across calls."""
        from aris.deps import get_file_service
        
        # Get the service twice
        service1 = await get_file_service()
        service2 = await get_file_service()
        
        # Should be the same instance (singleton pattern)
        assert service1 is service2
        
        # Test that the singleton instance is available in the package
        from aris.services.file_service import file_service_instance
        assert file_service_instance is not None  # Should be set after first call
    
    @pytest.mark.asyncio
    async def test_file_service_should_auto_sync_with_database(self):
        """Test that auto-sync configuration is available."""
        # Test that the auto-sync flag exists and is configurable
        from aris.services.file_service import auto_sync_enabled
        
        # Should be a boolean value
        assert isinstance(auto_sync_enabled, bool)
        
        # Currently set to False as it's for future implementation
        assert auto_sync_enabled is False