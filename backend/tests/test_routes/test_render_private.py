"""Tests for private render endpoint with asset resolver."""

from httpx import AsyncClient

from aris.models.models import File, FileAsset


class TestRenderPrivate:
    """Test private render endpoint functionality."""

    async def test_render_private_requires_auth(self, client: AsyncClient):
        """Test that private render endpoint requires authentication."""
        response = await client.post(
            "/render/private",
            json={"source": ":rsm: test ::", "file_id": 1}
        )
        assert response.status_code == 401

    async def test_render_private_with_auth_no_assets(self, client: AsyncClient, authenticated_user):
        """Test private render with authenticated user but no assets."""
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        response = await client.post(
            "/render/private",
            json={"source": ":rsm: test content ::", "file_id": 999},
            headers=headers
        )

        assert response.status_code == 200
        assert "test content" in response.json()

    async def test_render_private_with_assets(self, client: AsyncClient, authenticated_user, db_session):
        """Test private render with assets available."""
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        # Create a file first
        file = File(owner_id=authenticated_user['user_id'], source=":rsm: test ::")
        db_session.add(file)
        await db_session.commit()
        await db_session.refresh(file)

        # Create a file asset
        asset = FileAsset(
            filename="test_figure.html",
            mime_type="text/html",
            content="<div class='test-figure'>Test Figure Content</div>",
            file_id=file.id,
            owner_id=authenticated_user['user_id']
        )
        db_session.add(asset)
        await db_session.commit()

        rsm_source = """:rsm:

:figure:
  :path: test_figure.html

::

::"""

        response = await client.post(
            "/render/private",
            json={"source": rsm_source, "file_id": file.id},
            headers=headers
        )

        assert response.status_code == 200
        html_result = response.json()
        assert "Test Figure Content" in html_result

    async def test_render_private_missing_file_id(self, client: AsyncClient, authenticated_user):
        """Test private render endpoint requires file_id."""
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        response = await client.post(
            "/render/private",
            json={"source": ":rsm: test ::"},
            headers=headers
        )

        assert response.status_code == 422

    async def test_render_private_vs_public_behavior(self, client: AsyncClient, authenticated_user, db_session):
        """Test that private endpoint can access assets while public cannot."""
        headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

        # Create a file first
        file = File(owner_id=authenticated_user['user_id'], source=":rsm: test ::")
        db_session.add(file)
        await db_session.commit()
        await db_session.refresh(file)

        # Create a file asset
        asset = FileAsset(
            filename="private_asset.html",
            mime_type="text/html",
            content="<div>Private Asset</div>",
            file_id=file.id,
            owner_id=authenticated_user['user_id']
        )
        db_session.add(asset)
        await db_session.commit()

        rsm_source = """:rsm:

:figure:
  :path: private_asset.html

::

::"""

        # Public endpoint - should fail to find asset
        public_response = await client.post(
            "/render",
            json={"source": rsm_source}
        )
        assert public_response.status_code == 200
        public_html = public_response.json()
        assert "Private Asset" not in public_html

        # Private endpoint - should find and embed asset
        private_response = await client.post(
            "/render/private",
            json={"source": rsm_source, "file_id": file.id},
            headers=headers
        )
        assert private_response.status_code == 200
        private_html = private_response.json()
        assert "Private Asset" in private_html
