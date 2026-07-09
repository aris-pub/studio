"""add files.ydoc_state binary column for CRDT-state persistence

Stores the authoritative encoded Y.Doc state (pycrdt doc.get_update()) so the
collaboration client can restore documents via apply_update (idempotent) instead
of re-typing the plaintext `source` into a fresh Doc on every load (which mints
new CRDT identity and duplicates content on merge). Additive and nullable:
existing rows stay valid; the collab client seeds ydoc_state once from `source`
on first load, after which the binary column is authoritative. `source` keeps
being written as a derived plaintext projection, so this change is reversible.

Revision ID: h3c4d5e6f7a8
Revises: g2b3c4d5e6f7
Create Date: 2026-07-09 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "h3c4d5e6f7a8"
down_revision: Union[str, None] = "g2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "files",
        sa.Column("ydoc_state", sa.LargeBinary(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("files", "ydoc_state")
