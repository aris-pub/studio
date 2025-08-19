"""Test render routes."""

import tempfile
from pathlib import Path
from unittest.mock import patch

from httpx import AsyncClient


OUTPUT = """
<body>

<div class="manuscriptwrapper">

<div class="manuscript" data-nodeid="0">

<section class="level-1">

<div class="paragraph hr hr-hidden" tabindex=0 data-nodeid="1">

<div class="hr-collapse-zone">
<div class="hr-spacer"></div>
</div>

<div class="hr-menu-zone">

<div class="hr-menu">

  <div class="hr-menu-label">
    <span class="hr-menu-item-text">Paragraph</span>
  </div>

  <div class="hr-menu-separator"></div>

  <div class="hr-menu-item link disabled">
    <span class="icon link">
    </span>
    <span class="hr-menu-item-text">Copy link</span>
  </div>

  <div class="hr-menu-item">
    <span class="icon tree">
    </span>
    <span class="hr-menu-item-text">Tree</span>
  </div>

  <div class="hr-menu-item">
    <span class="icon code">
    </span>
    <span class="hr-menu-item-text">Source</span>
  </div>

</div>

</div>

<div class="hr-border-zone">

                <div class="hr-border-dots">
                  <div class="icon dots">
                  </div>
                </div>
                <div class="hr-border-rect">
                </div>

</div>

<div class="hr-spacer-zone">
<div class="hr-spacer"></div>
</div>

<div class="hr-content-zone">

<p>foo</p>

</div>

<div class="hr-info-zone">
<div class="hr-info"></div>
</div>

</div>

</section>

</div>

</div>

</body>
"""


async def test_render(client: AsyncClient):
    """Test that files endpoint requires authentication."""
    response = await client.post("/render", json={"source": ":rsm:foo::"})
    assert response.status_code == 200
    assert OUTPUT.strip() == response.json().strip()


async def test_render_with_static_figure_asset(client: AsyncClient):
    """Test that public render endpoint resolves figures from static files."""
    # Test RSM with figure directive pointing to existing static asset
    rsm_source = """:rsm:
# Test Document with Interactive Chart

:figure:
  :path: plotly-chart.html
::

This document demonstrates web-native publishing with interactive figures.
::"""
    
    response = await client.post("/render", json={"source": rsm_source})
    assert response.status_code == 200
    
    rendered_html = response.json()
    
    # Verify the figure content is included in the response
    assert "Test Document with Interactive Chart" in rendered_html
    assert "Iris Species Classification by Petal Dimensions" in rendered_html
    assert "Iris Setosa" in rendered_html
    assert "plotly.js v3.0.1" in rendered_html  # Check for embedded Plotly library
    assert "plotly-chart" in rendered_html
    assert "This document demonstrates web-native publishing" in rendered_html


async def test_render_with_missing_static_figure_asset(client: AsyncClient):
    """Test that public render endpoint gracefully handles missing static files."""
    # Test RSM with figure directive pointing to non-existent file
    rsm_source = """:rsm:
# Test Document

:figure:
  :path: nonexistent_chart.html
::

End of document.
::"""
    
    response = await client.post("/render", json={"source": rsm_source})
    assert response.status_code == 200
    
    rendered_html = response.json()
    
    # Should render successfully with error message for missing figure
    # (RSM handles missing assets gracefully with error placeholder)
    assert "Test Document" in rendered_html
    assert "End of document" in rendered_html
    # Should contain error message for missing asset
    assert "html-error" in rendered_html
    assert "Unable to load HTML asset: nonexistent_chart.html" in rendered_html


async def test_render_with_path_traversal_attempt(client: AsyncClient):
    """Test that public render endpoint prevents path traversal attacks."""
    # Test RSM with figure directive attempting path traversal
    rsm_source = """:rsm:
# Security Test Document

:figure:
  :path: ../../../etc/passwd
::

End of document.
::"""
    
    response = await client.post("/render", json={"source": rsm_source})
    assert response.status_code == 200
    
    rendered_html = response.json()
    
    # Should render successfully - RSM may skip invalid figures silently
    # Path traversal should not work - no sensitive content should be included
    assert "Security Test Document" in rendered_html
    assert "End of document" in rendered_html
    # Should not contain any sensitive system file content like /etc/passwd entries
    assert "root:" not in rendered_html
    assert "/bin/bash" not in rendered_html
    assert "/bin/sh" not in rendered_html


async def test_render_with_empty_figure_path(client: AsyncClient):
    """Test that public render endpoint handles empty figure paths gracefully."""
    # Test RSM with figure directive with empty path
    rsm_source = """:rsm:
# Empty Path Test

:figure:
  :path: 
::

End of document.
::"""
    
    response = await client.post("/render", json={"source": rsm_source})
    assert response.status_code == 200
    
    rendered_html = response.json()
    
    # Should render successfully
    assert "Empty Path Test" in rendered_html
    assert "End of document" in rendered_html
    # Should handle empty path gracefully


async def test_render_with_special_characters_in_path(client: AsyncClient):
    """Test that public render endpoint handles special characters in paths."""
    # Test RSM with figure directive containing special characters
    rsm_source = """:rsm:
# Special Characters Test

:figure:
  :path: test file with spaces & symbols!.html
::

End of document.
::"""
    
    response = await client.post("/render", json={"source": rsm_source})
    assert response.status_code == 200
    
    rendered_html = response.json()
    
    # Should render successfully with error for missing file
    assert "Special Characters Test" in rendered_html
    assert "End of document" in rendered_html
    assert "html-error" in rendered_html
    assert "Unable to load HTML asset: test file with spaces & symbols!.html" in rendered_html


async def test_render_with_multiple_figures(client: AsyncClient):
    """Test that public render endpoint handles multiple figures correctly."""
    # Create temporary static directory and files
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_static_dir = Path(temp_dir)
        
        # Create multiple test files
        test_files = {
            "chart1.html": "<div class='chart1'>Chart 1 Content</div>",
            "chart2.html": "<div class='chart2'>Chart 2 Content</div>",
            "chart3.html": "<div class='chart3'>Chart 3 Content</div>"
        }
        
        for filename, content in test_files.items():
            (temp_static_dir / filename).write_text(content, encoding='utf-8')
        
        # Mock the StaticFileAssetResolver
        with patch('aris.crud.render.StaticFileAssetResolver') as mock_resolver_class:
            mock_resolver = mock_resolver_class.return_value
            
            def mock_resolve_asset(path: str):
                asset_path = temp_static_dir / path
                if asset_path.exists():
                    return asset_path.read_text(encoding='utf-8')
                return None
            
            mock_resolver.resolve_asset.side_effect = mock_resolve_asset
            
            # Test RSM with multiple figure directives
            rsm_source = """:rsm:
# Multiple Figures Test

:figure:
  :path: chart1.html
::

Some text between figures.

:figure:
  :path: chart2.html
::

:figure:
  :path: chart3.html
::

End of document.
::"""
            
            response = await client.post("/render", json={"source": rsm_source})
            assert response.status_code == 200
            
            rendered_html = response.json()
            
            # Verify all figures are included
            assert "Multiple Figures Test" in rendered_html
            assert "Chart 1 Content" in rendered_html
            assert "Chart 2 Content" in rendered_html
            assert "Chart 3 Content" in rendered_html
            assert "Some text between figures" in rendered_html
            assert "End of document" in rendered_html
            
            # Verify resolver was called for each file (order may vary)
            actual_calls = [call[0][0] for call in mock_resolver.resolve_asset.call_args_list]
            expected_files = {"chart1.html", "chart2.html", "chart3.html"}
            assert set(actual_calls) == expected_files
            assert len(actual_calls) == 3


async def test_render_with_large_static_file(client: AsyncClient):
    """Test that public render endpoint handles large static files appropriately."""
    # Create temporary static directory and large file
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_static_dir = Path(temp_dir)
        large_file_path = temp_static_dir / "large_chart.html"
        
        # Create a large HTML content (100KB)
        large_content = "<div class='large-chart'>\n"
        large_content += "  <!-- Large chart content -->\n" * 3000  # ~90KB
        large_content += "  <h3>Large Chart Title</h3>\n"
        large_content += "  <p>This is a large chart file for testing.</p>\n"
        large_content += "</div>"
        
        large_file_path.write_text(large_content, encoding='utf-8')
        
        # Mock the StaticFileAssetResolver
        with patch('aris.crud.render.StaticFileAssetResolver') as mock_resolver_class:
            mock_resolver = mock_resolver_class.return_value
            
            def mock_resolve_asset(path: str):
                asset_path = temp_static_dir / path
                if asset_path.exists():
                    return asset_path.read_text(encoding='utf-8')
                return None
            
            mock_resolver.resolve_asset.side_effect = mock_resolve_asset
            
            # Test RSM with large figure
            rsm_source = """:rsm:
# Large File Test

:figure:
  :path: large_chart.html
::

End of document.
::"""
            
            response = await client.post("/render", json={"source": rsm_source})
            assert response.status_code == 200
            
            rendered_html = response.json()
            
            # Verify large file content is included
            assert "Large File Test" in rendered_html
            assert "Large Chart Title" in rendered_html
            assert "This is a large chart file for testing" in rendered_html
            assert "End of document" in rendered_html
            assert "large-chart" in rendered_html
            
            # Verify the response is reasonably large (indicates file was loaded)
            assert len(rendered_html) > 50000  # Should be quite large due to included content
