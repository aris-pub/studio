"""Exporting a file as a standalone HTML or PDF download."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import current_user, get_db, get_file_service
from ..asset_filenames import validate_asset_filename
from ..authorization import (
    require_view,
)
from ..collaboration import get_collaboration_manager
from ..config import settings
from ..logging_config import get_logger
from ..models import File, FileRole
from ..services.file_service import InMemoryFileService


logger = get_logger(__name__)


router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(current_user)])


class _ExportBody(BaseModel):
    """Optional request body for export routes — provides live editor source."""
    source: str = ""


@router.post("/{file_id}/download/pdf")
async def download_file_pdf(
    file_id: int,
    body: Optional[_ExportBody] = None,
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Download file as a PDF document via Typst.

    Accepts an optional JSON body with ``source`` containing the live editor
    content.  When omitted, falls back to the Y.js collaboration client or the
    database.
    """
    import asyncio
    import os
    import re
    import subprocess
    import tempfile

    from rsm.app import pandoc_export as rsm_pandoc_export

    await file_service.sync_from_database(db)
    file_data = await file_service.get_file(file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")

    # Priority: request body > flushed DB content
    source = (body.source if body and body.source else None)
    if not source:
        # Flush the live collab client to the DB, then read the persisted source.
        # Reading the Y.js client's text directly races the save loop and touches
        # pycrdt internals from outside its own loop (std-es20w7).
        await get_collaboration_manager().flush(file_id)
        source = (
            await db.execute(select(File.source).where(File.id == file_id))
        ).scalar_one_or_none()
    if not source:
        source = file_data.source
    if not source:
        raise HTTPException(status_code=404, detail="File has no content")

    try:
        typst_source = await asyncio.to_thread(
            rsm_pandoc_export,
            source,
            to_format="typst",
        )
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"PDF export is not yet supported for this document. The RSM-to-PDF pipeline encountered an error: {e}",
        )

    # Cross-references and citations are now handled by the RSM Pandoc
    # translator with proper labels — no post-processing needed

    with tempfile.TemporaryDirectory() as tmpdir:
        typ_path = os.path.join(tmpdir, "manuscript.typ")
        pdf_path = os.path.join(tmpdir, "manuscript.pdf")
        with open(typ_path, "w", encoding="utf-8") as f:
            f.write(typst_source)

        # Write file assets (images, SVGs, static fallbacks) to temp dir
        import base64
        import binascii

        from ..models import FileAsset
        asset_result = await db.execute(
            select(FileAsset)
            .where(FileAsset.file_id == file_id)
            .where(FileAsset.deleted_at.is_(None))
        )
        assets = asset_result.scalars().all()

        # Per-asset size is capped on upload (MAX_ASSET_BYTES), but a document can
        # reference many assets, so cap the TOTAL bytes to avoid a disk-fill DoS.
        # base64 content decodes to about 3/4 of its length.
        total_bytes = len(typst_source.encode("utf-8"))
        for a in assets:
            if getattr(a, "content_encoding", "plain") == "base64":
                total_bytes += len(a.content) * 3 // 4
            else:
                total_bytes += len(a.content.encode("utf-8"))
        if total_bytes > settings.PDF_EXPORT_MAX_TOTAL_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Document exceeds the maximum total size for PDF export",
            )

        for asset in assets:
            try:
                # Rows written before filenames were validated on the way in can
                # still carry a path, which would escape tmpdir.
                asset_path = os.path.join(tmpdir, validate_asset_filename(asset.filename))
                encoding = getattr(asset, "content_encoding", "plain")
                if encoding == "base64":
                    data = base64.b64decode(asset.content)
                    with open(asset_path, "wb") as af:
                        af.write(data)
                else:
                    with open(asset_path, "w", encoding="utf-8") as af:
                        af.write(asset.content)
            except (binascii.Error, OSError, ValueError):
                logger.warning("Failed to write asset %s for file %s", asset.filename, file_id, exc_info=True)
        # First compilation attempt
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                ["typst", "compile", typ_path, pdf_path],
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="typst not found; install typst")

        # If compilation had errors, strip broken image references and retry
        if result.returncode != 0 and result.stderr:
            import re as _re
            fixed_source = typst_source
            # Match filenames from Typst errors like:
            #   "searched at /tmp/.../file.svg)"  or  "/file.svg:"
            for m in _re.finditer(r'/([^\s/]+\.\w+)[):\s]', result.stderr):
                bad_file = m.group(1)
                fixed_source = fixed_source.replace(
                    f'image("{bad_file}")',
                    f'text(fill: rgb("#888"))[Figure: {bad_file} — could not render]',
                )
            with open(typ_path, "w", encoding="utf-8") as f:
                f.write(fixed_source)
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
            try:
                await asyncio.to_thread(
                    subprocess.run,
                    ["typst", "compile", typ_path, pdf_path],
                    capture_output=True,
                )
            except FileNotFoundError:
                logger.error("typst binary not found during retry compilation for file %s", file_id)

        if not os.path.exists(pdf_path):
            stderr = getattr(result, 'stderr', '') or ''
            # Filter out font warnings to show actual errors
            error_lines = [line for line in stderr.splitlines() if 'error' in line.lower() and 'unknown font' not in line.lower()]
            error_msg = '\n'.join(error_lines[:10]) if error_lines else stderr[:1000]
            raise HTTPException(
                status_code=422,
                detail=f"PDF compilation failed: {error_msg}" if error_msg else "PDF compilation produced no output",
            )
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

    title = await file_service.get_file_title(file_id)
    if not title:
        title = str(file_data.title) if file_data.title else "manuscript"
    filename = re.sub(r'[<>:"/\\|?*]', '_', title) + ".pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/{file_id}/download")
async def download_file(
    file_id: int,
    body: Optional[_ExportBody] = None,
    user_role: FileRole = Depends(require_view),
    file_service: InMemoryFileService = Depends(get_file_service),
    db: AsyncSession = Depends(get_db),
):
    """Download file as a complete standalone HTML document.

    Accepts an optional JSON body with ``source`` containing the live editor
    content.  When omitted, falls back to the Y.js collaboration client or the
    database.
    """
    import asyncio
    import re

    import rsm

    await file_service.sync_from_database(db)
    file_data = await file_service.get_file(file_id)
    if not file_data:
        raise HTTPException(status_code=404, detail="File not found")

    # Priority: request body > flushed DB content
    source = (body.source if body and body.source else None)
    if not source:
        # Flush the live collab client to the DB, then read the persisted source.
        # Reading the Y.js client's text directly races the save loop and touches
        # pycrdt internals from outside its own loop (std-es20w7).
        await get_collaboration_manager().flush(file_id)
        source = (
            await db.execute(select(File.source).where(File.id == file_id))
        ).scalar_one_or_none()
    if not source:
        source = file_data.source
    if not source:
        raise HTTPException(status_code=404, detail="File has no content")

    # Create asset resolver to load file assets from database
    from ..services.asset_resolver import FileAssetResolver
    asset_resolver = await FileAssetResolver.create_for_file(file_id, db)
    asset_resolver._standalone = True

    html = await asyncio.to_thread(
        rsm.build,
        source,
        handrails=False,
        lint=False,
        standalone=True,
        asset_resolver=asset_resolver
    )

    # Get file title for filename
    title = await file_service.get_file_title(file_id)
    if not title:
        title = str(file_data.title) if file_data.title else "manuscript"

    # Sanitize filename (remove invalid characters)
    filename = re.sub(r'[<>:"/\\|?*]', '_', title) + '.html'

    # Return as downloadable file
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

