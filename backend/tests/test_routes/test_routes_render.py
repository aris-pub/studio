"""Test render routes."""

import tempfile
from pathlib import Path
from unittest.mock import patch

from httpx import AsyncClient


OUTPUT = """
<body data-accent="blue" data-lang="en" data-typography="sans-serif">

<main class="manuscriptwrapper">

<div class="manuscript" data-nodeid="0">

<section class="level-1">

<div class="paragraph hr hr-hidden" tabindex=0 data-nodeid="1">

<div class="hr-collapse-zone">
<div class="hr-spacer"></div>
</div>

<div class="hr-menu-zone">
</div>

<div class="hr-border-zone">

                <div class="hr-border-dots">
                  <div class="icon dots"><svg width="16" height="16"><use href="#hr-icon-dots" width="16" height="16"/></svg></div>
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

</main>

</body>
"""


async def test_render(client: AsyncClient):
    """Test that files endpoint requires authentication."""
    import re as _re
    response = await client.post("/render", json={"source": "foo"})
    assert response.status_code == 200
    rendered = response.json()
    rendered = _re.sub(r'<svg id="hr-icon-defs"[^>]*>.*?</svg>\n?', '', rendered, flags=_re.DOTALL)
    rendered = _re.sub(r'<div id="hr-menu-singleton".*?</div>\s*</div>\s*</div>\n?', '', rendered, flags=_re.DOTALL)
    rendered = _re.sub(r'\s*data-menu-[\w-]+="[^"]*"', '', rendered)
    assert "".join(OUTPUT.split()) == "".join(rendered.split())


async def test_render_with_static_figure_asset(client: AsyncClient):
    """Test that public render endpoint resolves figures from static files."""
    # Create a small test HTML file in the RSM static directory
    import rsm
    rsm_static_dir = Path(rsm.__file__).parent / "static"
    test_file_path = rsm_static_dir / "test-chart.html"

    # Create test content (small, not 4.4MB!)
    test_chart_content = """<div id="test-chart">
    <h2>Iris Species Classification by Petal Dimensions</h2>
    <div class="chart-data">
        <span class="species">Iris Setosa</span>
    </div>
</div>
<script>
    Plotly.newPlot('test-chart', data, layout);
</script>"""

    try:
        # Write temporary test file
        test_file_path.write_text(test_chart_content, encoding='utf-8')

        # Test RSM with figure directive pointing to test static asset
        rsm_source = """# Test Document with Interactive Chart

:figure: {
  :path: test-chart.html
} ::

This document demonstrates web-native publishing with interactive figures.
"""

        response = await client.post("/render", json={"source": rsm_source})
        assert response.status_code == 200

        rendered_html = response.json()

        # Verify the figure content is included in the response
        assert "Test Document with Interactive Chart" in rendered_html
        assert "test-chart" in rendered_html
        assert "This document demonstrates web-native publishing" in rendered_html

    finally:
        # Clean up test file
        if test_file_path.exists():
            test_file_path.unlink()


async def test_render_with_missing_static_figure_asset(client: AsyncClient):
    """Test that public render endpoint gracefully handles missing static files."""
    # Test RSM with figure directive pointing to non-existent file
    rsm_source = """# Test Document

:figure: {
  :path: nonexistent_chart.html
} ::

End of document.
"""

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
    rsm_source = """# Security Test Document

:figure:
  :path: ../../../etc/passwd
::

End of document.
"""

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
    rsm_source = """# Empty Path Test

:figure:
  {:path: }
::

End of document.
"""

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
    rsm_source = """# Special Characters Test

:figure:{
  :path: test file with spaces & symbols!.html
}
::

End of document.
"""

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
            rsm_source = """# Multiple Figures Test

:figure:
  {:path: chart1.html
}
::

Some text between figures.

:figure:
  {:path: chart2.html
}
::

:figure:
  {:path: chart3.html
}
::

End of document.
"""

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
            rsm_source = """# Large File Test

:figure:
  {:path: large_chart.html
}
::

End of document.
"""

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


async def test_render_structured_has_no_theme_toggle(client: AsyncClient):
    """Test that structured format rendering does NOT include theme toggle button.

    Regression test: The theme toggle button should be disabled in Studio rendering
    to avoid conflicts with the app's own theme management.
    """
    response = await client.post("/render", json={"source": "# Test\n\nHello world", "format": "structured"})
    assert response.status_code == 200

    result = response.json()

    # Structured format returns {head, body, init_script}
    assert isinstance(result, dict)
    assert "body" in result

    # Verify theme toggle button does NOT exist in the rendered output
    assert "rsm-theme-toggle" not in result["body"]
    assert "theme-toggle" not in result["body"]
