"""Tests for POST /files/import — multi-format file import endpoint."""

import io
import shutil

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio

_PANDOC_AVAILABLE = shutil.which("pandoc") is not None
skip_no_pandoc = pytest.mark.skipif(not _PANDOC_AVAILABLE, reason="pandoc not installed")


# ─── Fixtures ────────────────────────────────────────────────────────────────


SAMPLE_MARKDOWN = "# My Paper\n\nThis is the **introduction**.\n"
SAMPLE_LATEX = r"""
\documentclass{article}
\begin{document}
\section{Introduction}
Hello from \LaTeX.
\end{document}
"""


# ─── Format detection ────────────────────────────────────────────────────────


@skip_no_pandoc
async def test_import_markdown(authenticated_client: AsyncClient):
    response = await authenticated_client.post(
        "/files/import",
        files={"file": ("paper.md", io.BytesIO(SAMPLE_MARKDOWN.encode()), "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert isinstance(data["id"], int)


@skip_no_pandoc
async def test_import_latex(authenticated_client: AsyncClient):
    response = await authenticated_client.post(
        "/files/import",
        files={"file": ("paper.tex", io.BytesIO(SAMPLE_LATEX.encode()), "text/plain")},
    )
    assert response.status_code == 200
    assert "id" in response.json()


@skip_no_pandoc
async def test_import_latex_extension(authenticated_client: AsyncClient):
    """The .latex extension should also be detected as LaTeX."""
    response = await authenticated_client.post(
        "/files/import",
        files={"file": ("paper.latex", io.BytesIO(SAMPLE_LATEX.encode()), "text/plain")},
    )
    assert response.status_code == 200
    assert "id" in response.json()


@skip_no_pandoc
async def test_import_explicit_format(authenticated_client: AsyncClient):
    """Explicit format param overrides extension-based detection."""
    response = await authenticated_client.post(
        "/files/import",
        params={"format": "markdown"},
        files={"file": ("notes.txt", io.BytesIO(SAMPLE_MARKDOWN.encode()), "text/plain")},
    )
    assert response.status_code == 200
    assert "id" in response.json()


@skip_no_pandoc
async def test_import_creates_viewable_file(authenticated_client: AsyncClient):
    """Imported file can be retrieved via GET /files/{id}."""
    resp = await authenticated_client.post(
        "/files/import",
        files={"file": ("paper.md", io.BytesIO(SAMPLE_MARKDOWN.encode()), "text/plain")},
    )
    file_id = resp.json()["id"]

    get_resp = await authenticated_client.get(f"/files/{file_id}")
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["source"]  # non-empty RSM source
    assert body["id"] == file_id


@skip_no_pandoc
async def test_import_extracts_title(authenticated_client: AsyncClient):
    """Title is extracted from the first heading in converted RSM."""
    md = "# Quantum Gravity\n\nSome content.\n"
    resp = await authenticated_client.post(
        "/files/import",
        files={"file": ("qg.md", io.BytesIO(md.encode()), "text/plain")},
    )
    file_id = resp.json()["id"]
    get_resp = await authenticated_client.get(f"/files/{file_id}")
    title = get_resp.json()["title"]
    assert "Quantum" in title


# ─── Error cases ─────────────────────────────────────────────────────────────


async def test_import_unknown_extension(authenticated_client: AsyncClient):
    response = await authenticated_client.post(
        "/files/import",
        files={"file": ("data.csv", io.BytesIO(b"a,b,c"), "text/csv")},
    )
    assert response.status_code == 400
    assert "Cannot detect format" in response.json()["detail"]


async def test_import_unsupported_format(authenticated_client: AsyncClient):
    response = await authenticated_client.post(
        "/files/import",
        params={"format": "rst"},
        files={"file": ("doc.rst", io.BytesIO(b"heading\n======="), "text/plain")},
    )
    assert response.status_code == 400
    assert "Unsupported format" in response.json()["detail"]


async def test_import_requires_auth(client: AsyncClient):
    response = await client.post(
        "/files/import",
        files={"file": ("paper.md", io.BytesIO(b"# Title"), "text/plain")},
    )
    assert response.status_code == 401
