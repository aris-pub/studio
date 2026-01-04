"""Test file routes."""

from httpx import AsyncClient


async def test_get_files_without_auth(client: AsyncClient):
    """Test that files endpoint requires authentication."""
    response = await client.get("/files")
    assert response.status_code == 401


async def test_get_files_with_auth(client: AsyncClient, authenticated_user):
    """Test getting files list with authentication."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get("/files", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_create_file_valid_rsm_source(client: AsyncClient, authenticated_user):
    """Test creating a file with valid RSM source."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:test content::",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "id" in data


async def test_create_file_invalid_rsm_source_no_prefix(client: AsyncClient, authenticated_user):
    """Test creating a file with invalid RSM source (missing :rsm: prefix)."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": "test content without proper prefix",
        },
    )

    assert response.status_code == 422
    assert "Malformed RSM source" in response.json()["detail"][0]["msg"]


async def test_create_file_invalid_rsm_source_no_suffix(client: AsyncClient, authenticated_user):
    """Test creating a file with invalid RSM source (missing :: suffix)."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:test content without suffix",
        },
    )

    assert response.status_code == 422
    assert "Malformed RSM source" in response.json()["detail"][0]["msg"]


async def test_get_file_by_id(client: AsyncClient, authenticated_user):
    """Test getting a specific file by ID."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:test content::",
        },
    )
    file_id = create_response.json()["id"]

    # Get the file
    response = await client.get(f"/files/{file_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == file_id
    assert data["title"] == "Test Document"


async def test_get_nonexistent_file(client: AsyncClient, authenticated_user):
    """Test getting a file that doesn't exist."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}
    response = await client.get("/files/99999", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "File not found"


async def test_update_file(client: AsyncClient, authenticated_user):
    """Test updating a file."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Original Title",
            "abstract": "Original abstract",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:original content::",
        },
    )
    file_id = create_response.json()["id"]

    # Update the file
    response = await client.put(
        f"/files/{file_id}",
        headers=headers,
        json={
            "title": "Updated Title",
            "abstract": "Updated abstract",
            "source": ":rsm:updated content::",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["abstract"] == "Updated abstract"


async def test_update_file_invalid_rsm(client: AsyncClient, authenticated_user):
    """Test updating a file with invalid RSM source."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "Test abstract",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:test content::",
        },
    )
    file_id = create_response.json()["id"]

    # Try to update with invalid RSM
    response = await client.put(
        f"/files/{file_id}",
        headers=headers,
        json={
            "source": "invalid rsm content",
        },
    )

    assert response.status_code == 422
    assert "Malformed RSM source" in response.json()["detail"][0]["msg"]


async def test_delete_file(client: AsyncClient, authenticated_user):
    """Test deleting a file."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "To Be Deleted",
            "abstract": "This will be deleted",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:delete me::",
        },
    )
    file_id = create_response.json()["id"]

    # Delete the file
    response = await client.delete(f"/files/{file_id}", headers=headers)
    assert response.status_code == 200

    # Verify it's deleted (should get 404)
    get_response = await client.get(f"/files/{file_id}", headers=headers)
    assert get_response.status_code == 404


async def test_duplicate_file(client: AsyncClient, authenticated_user):
    """Test duplicating a file."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Original File",
            "abstract": "Original abstract",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:original content::",
        },
    )
    file_id = create_response.json()["id"]

    # Duplicate the file
    response = await client.post(f"/files/{file_id}/duplicate", headers=headers)
    assert response.status_code == 200
    
    duplicate_data = response.json()
    assert "id" in duplicate_data
    assert duplicate_data["id"] != file_id
    assert duplicate_data["message"] == "File duplicated successfully"


async def test_get_file_content(client: AsyncClient, authenticated_user):
    """Test getting file content as HTML."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:# Heading\n\nSome content::",
        },
    )
    file_id = create_response.json()["id"]

    # Get the content
    response = await client.get(f"/files/{file_id}/content", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert "<h1>Heading</h1>" in response.text


async def test_get_file_content_section(client: AsyncClient, authenticated_user):
    """Test getting a specific section of file content."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file with sections
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:# Main Title\n\n## Section One\n\nContent::",
        },
    )
    file_id = create_response.json()["id"]

    # Get a specific section (level-2 refers to ## Section One)
    response = await client.get(f"/files/{file_id}/content/level-2", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"


async def test_get_file_assets(client: AsyncClient, authenticated_user):
    """Test getting file assets."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document",
            "abstract": "A test document",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:test content::",
        },
    )
    file_id = create_response.json()["id"]

    # Get assets (should be empty for new file)
    response = await client.get(f"/files/{file_id}/assets", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 0


async def test_file_permissions(client: AsyncClient, authenticated_user, second_authenticated_user):
    """Test that users can only access their own files."""
    headers_primary = {"Authorization": f"Bearer {authenticated_user['token']}"}
    headers_secondary = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    # Create a file with primary user
    create_response = await client.post(
        "/files",
        headers=headers_primary,
        json={
            "title": "Private File",
            "abstract": "Should not be accessible by others",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:private content::",
        },
    )
    file_id = create_response.json()["id"]

    # Try to access with secondary user
    response = await client.get(f"/files/{file_id}", headers=headers_secondary)
    assert response.status_code == 403
    assert response.json()["detail"] == "Access denied"

    # Try to update with secondary user
    update_response = await client.put(
        f"/files/{file_id}",
        headers=headers_secondary,
        json={"title": "Hacked Title"},
    )
    assert update_response.status_code == 403

    # Try to delete with secondary user
    delete_response = await client.delete(f"/files/{file_id}", headers=headers_secondary)
    assert delete_response.status_code == 403


async def test_create_file_missing_required_fields(client: AsyncClient, authenticated_user):
    """Test creating a file without required fields."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Test Document"
            # Missing required fields: owner_id, source
        },
    )

    assert response.status_code == 422  # Validation error


# Download endpoint tests
async def test_download_file_without_auth(client: AsyncClient):
    """Test that download endpoint requires authentication."""
    response = await client.get("/files/1/download")
    assert response.status_code == 401


async def test_download_file_success(client: AsyncClient, authenticated_user):
    """Test successful file download."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # First create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Download Test",
            "abstract": "A file for download testing",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:# Download Test\n\nThis is downloadable content::",
        },
    )
    file_id = create_response.json()["id"]

    # Download the file
    response = await client.get(f"/files/{file_id}/download", headers=headers)
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "attachment; filename=" in response.headers["content-disposition"]
    assert "Download Test.html" in response.headers["content-disposition"]
    assert "<h1>Download Test</h1>" in response.text
    assert "This is downloadable content" in response.text


async def test_download_file_returns_complete_html_document(client: AsyncClient, authenticated_user):
    """Test that downloaded file is a complete HTML document, not just body content.

    Regression test: Previously the download endpoint only returned the body content
    from rsm.render() instead of the full HTML document from rsm.make().
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Full HTML Test",
            "abstract": "Testing complete HTML output",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:# Full Document\n\nContent here::",
        },
    )
    file_id = create_response.json()["id"]

    response = await client.get(f"/files/{file_id}/download", headers=headers)
    assert response.status_code == 200

    # Must be a complete HTML document with html, head, and body tags
    assert "<html" in response.text.lower(), "Downloaded file must contain <html> tag"
    assert "<head" in response.text.lower(), "Downloaded file must contain <head> tag"
    assert "<body" in response.text.lower(), "Downloaded file must contain <body> tag"
    assert "</html>" in response.text.lower(), "Downloaded file must contain closing </html> tag"

    # Should include CSS/JS resources for standalone viewing
    assert "rsm.css" in response.text or "<style" in response.text, "Downloaded file should include styles"


async def test_download_file_permission_denied(client: AsyncClient, authenticated_user, second_authenticated_user):
    """Test that users can only download files they own."""
    headers_primary = {"Authorization": f"Bearer {authenticated_user['token']}"}
    headers_secondary = {"Authorization": f"Bearer {second_authenticated_user['token']}"}

    # Create a file with primary user
    create_response = await client.post(
        "/files",
        headers=headers_primary,
        json={
            "title": "Private Download",
            "abstract": "Should not be downloadable by others",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:private content::",
        },
    )
    file_id = create_response.json()["id"]

    # Try to download with secondary user
    response = await client.get(f"/files/{file_id}/download", headers=headers_secondary)
    assert response.status_code == 403
    assert response.json()["detail"] == "Access denied"


# Standalone download tests - files that work when opened locally
async def test_download_file_uses_cdn_urls(client: AsyncClient, authenticated_user):
    """Test that downloaded file uses CDN URLs instead of /static/ paths.

    Downloaded files must be standalone - they should load CSS/JS from CDN
    so they work when opened as file:// URLs in a browser.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Standalone Test",
            "abstract": "Testing standalone output",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:# Standalone Document\n\nContent here::",
        },
    )
    file_id = create_response.json()["id"]

    response = await client.get(f"/files/{file_id}/download", headers=headers)
    assert response.status_code == 200

    # Should NOT use /static/ paths (these fail when opened locally)
    assert 'href="/static/rsm.css"' not in response.text
    assert 'src="/static/jquery' not in response.text
    assert 'src="/static/tooltipster' not in response.text

    # Should use CDN URLs for third-party libraries
    assert "cdn.jsdelivr.net" in response.text


async def test_download_file_uses_correct_jquery_version(client: AsyncClient, authenticated_user):
    """Test that downloaded file uses jQuery 3.6.0 from CDN."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "jQuery Version Test",
            "abstract": "Testing jQuery CDN version",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:Test content::",
        },
    )
    file_id = create_response.json()["id"]

    response = await client.get(f"/files/{file_id}/download", headers=headers)
    assert response.status_code == 200

    # Must use exact jQuery version to match bundled version
    assert "jquery@3.6.0" in response.text


async def test_download_file_uses_tooltipster_cdn(client: AsyncClient, authenticated_user):
    """Test that downloaded file uses Tooltipster from CDN."""
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Tooltipster CDN Test",
            "abstract": "Testing Tooltipster CDN",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:Test content::",
        },
    )
    file_id = create_response.json()["id"]

    response = await client.get(f"/files/{file_id}/download", headers=headers)
    assert response.status_code == 200

    # Should use Tooltipster 4.x from CDN
    assert "tooltipster@4" in response.text


async def test_download_file_includes_html_assets(client: AsyncClient, authenticated_user):
    """Test that downloaded file includes embedded HTML assets.

    Regression test: Downloaded files showed "Unable to load HTML asset: filename.html"
    because the download endpoint didn't use an asset resolver to load file assets
    from the database.
    """
    headers = {"Authorization": f"Bearer {authenticated_user['token']}"}

    # Create a file
    create_response = await client.post(
        "/files",
        headers=headers,
        json={
            "title": "Chart Document",
            "abstract": "Document with interactive chart",
            "owner_id": authenticated_user["user_id"],
            "source": ":rsm:Placeholder content::",
        },
    )
    file_id = create_response.json()["id"]

    # Upload an HTML asset (simulating a Plotly chart)
    chart_html = """<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body><div id="plotly-chart">Interactive Chart Content</div>
<script>console.log("Chart initialized");</script>
</body></html>"""

    import base64
    asset_content = base64.b64encode(chart_html.encode()).decode()

    asset_response = await client.post(
        "/assets",
        headers=headers,
        json={
            "filename": "scatter-chart.html",
            "mime_type": "text/html",
            "content": asset_content,
            "content_encoding": "base64",
            "file_id": file_id,
        },
    )
    assert asset_response.status_code == 200

    # Update file source to reference the HTML asset
    source_with_asset = """:rsm:

# Document with Chart

Here is the interactive chart:

:html:
  :path: scatter-chart.html
  :caption: Interactive scatter plot.
::

::"""

    update_response = await client.put(
        f"/files/{file_id}",
        headers=headers,
        json={"source": source_with_asset},
    )
    assert update_response.status_code == 200

    # Download the file
    response = await client.get(f"/files/{file_id}/download", headers=headers)
    assert response.status_code == 200

    # The asset content MUST be embedded in the downloaded HTML
    assert "Interactive Chart Content" in response.text, \
        "Downloaded file must include embedded HTML asset content"
    assert "plotly-chart" in response.text, \
        "Downloaded file must include the chart container"

    # Should NOT contain the error message
    assert "Unable to load HTML asset" not in response.text, \
        "Downloaded file should not show asset loading error"