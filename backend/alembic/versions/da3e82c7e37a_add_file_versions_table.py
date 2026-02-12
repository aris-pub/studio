"""add file_versions table

Revision ID: da3e82c7e37a
Revises: 453e2da040b7
Create Date: 2026-02-10 23:48:38.076485

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'da3e82c7e37a'
down_revision: Union[str, None] = '453e2da040b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'file_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('version_name', sa.String(255), nullable=True),
        sa.Column('rsm_content', sa.Text(), nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('abstract', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_id', 'version_number', name='uq_file_version_number')
    )
    op.create_index('ix_file_versions_file_id', 'file_versions', ['file_id'])
    op.create_index('ix_file_versions_created_at', 'file_versions', ['created_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_file_versions_created_at', 'file_versions')
    op.drop_index('ix_file_versions_file_id', 'file_versions')
    op.drop_table('file_versions')
