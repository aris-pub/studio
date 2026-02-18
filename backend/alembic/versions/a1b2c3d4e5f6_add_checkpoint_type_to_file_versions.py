"""add checkpoint_type to file_versions

Revision ID: a1b2c3d4e5f6
Revises: da3e82c7e37a
Create Date: 2026-02-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'da3e82c7e37a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add checkpoint_type column to distinguish auto-checkpoints from named versions."""
    op.add_column(
        'file_versions',
        sa.Column(
            'checkpoint_type',
            sa.String(10),
            nullable=False,
            server_default='manual',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('file_versions', 'checkpoint_type')
