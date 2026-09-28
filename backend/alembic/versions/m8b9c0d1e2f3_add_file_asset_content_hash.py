"""Add content_hash to file_assets for cache-stable asset URLs

std-do5t: the signed asset URL now carries a content-derived version so an
unchanged image stays cached across renders instead of being refetched on every
debounced recompile. content_hash stores the sha256 hex of the decoded content
bytes and is set on every write. This backfills existing rows so their first
post-deploy URL is already stable. Rows that cannot be decoded are left NULL; the
resolver and endpoint fall back to hashing on the fly for those, so nothing breaks.

The column is nullable and additive, so this migration does not touch or lose any
existing data.

Revision ID: m8b9c0d1e2f3
Revises: l7a8b9c0d1e2
Create Date: 2026-09-25

"""

import base64
import hashlib

import sqlalchemy as sa

from alembic import op


revision = "m8b9c0d1e2f3"
down_revision = "l7a8b9c0d1e2"
branch_labels = None
depends_on = None


def _content_hash(content: str, encoding: str) -> str:
    if encoding == "base64":
        data = base64.b64decode(content)
    else:
        data = content.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def upgrade() -> None:
    op.add_column("file_assets", sa.Column("content_hash", sa.String(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, content, content_encoding FROM file_assets")
    ).fetchall()
    for row in rows:
        try:
            digest = _content_hash(row.content, row.content_encoding or "plain")
        except Exception:
            # Undecodable row: leave content_hash NULL, the app hashes it on the fly.
            continue
        bind.execute(
            sa.text("UPDATE file_assets SET content_hash = :h WHERE id = :i"),
            {"h": digest, "i": row.id},
        )


def downgrade() -> None:
    op.drop_column("file_assets", "content_hash")
