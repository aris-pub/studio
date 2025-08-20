"""add_content_encoding_to_file_assets

Revision ID: 8e1299cafca1
Revises: daf48d360ee5
Create Date: 2025-08-19 15:55:22.490086

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '8e1299cafca1'
down_revision: Union[str, None] = 'daf48d360ee5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add content_encoding column to file_assets table
    op.add_column('file_assets', sa.Column('content_encoding', sa.String(), nullable=False, server_default='plain'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove content_encoding column from file_assets table
    op.drop_column('file_assets', 'content_encoding')
