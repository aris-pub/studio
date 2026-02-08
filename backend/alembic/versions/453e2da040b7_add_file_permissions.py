"""add file permissions

Revision ID: 453e2da040b7
Revises: e9295bc6c66f
Create Date: 2026-02-08 20:37:02.510148

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '453e2da040b7'
down_revision: Union[str, None] = 'e9295bc6c66f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create file_permissions table (SQLAlchemy will create the filerole enum automatically)
    op.create_table(
        'file_permissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.Enum('OWNER', 'EDITOR', 'COMMENTER', name='filerole'), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('granted_by', sa.Integer(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_id', 'user_id', 'deleted_at', name='uq_file_user_permission')
    )
    op.create_index('ix_file_permissions_file_id', 'file_permissions', ['file_id'])
    op.create_index('ix_file_permissions_user_id', 'file_permissions', ['user_id'])

    # Data migration: Create OWNER permissions for all existing files
    op.execute("""
        INSERT INTO file_permissions (file_id, user_id, role, granted_by, granted_at)
        SELECT id, owner_id, 'OWNER', owner_id, created_at
        FROM files
        WHERE deleted_at IS NULL
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_file_permissions_user_id', table_name='file_permissions')
    op.drop_index('ix_file_permissions_file_id', table_name='file_permissions')
    op.drop_table('file_permissions')
    op.execute("DROP TYPE filerole")
