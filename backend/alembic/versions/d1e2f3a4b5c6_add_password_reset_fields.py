"""add password reset fields

Revision ID: d1e2f3a4b5c6
Revises: c2c4fe54bfd7
Create Date: 2026-03-14 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add password_reset_token and password_reset_sent_at columns to users table."""
    op.add_column('users', sa.Column('password_reset_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('password_reset_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Remove password reset columns."""
    op.drop_column('users', 'password_reset_sent_at')
    op.drop_column('users', 'password_reset_token')
