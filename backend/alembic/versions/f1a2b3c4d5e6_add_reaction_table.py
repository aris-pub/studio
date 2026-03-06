"""add reaction table

Revision ID: f1a2b3c4d5e6
Revises: a9993a3aff56
Create Date: 2026-03-06 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'a9993a3aff56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('reaction',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('node_id', sa.String(), nullable=False),
        sa.Column('reaction_type', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_reaction_file_id', 'reaction', ['file_id'])
    op.create_index('ix_reaction_owner_node', 'reaction', ['owner_id', 'file_id', 'node_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_reaction_owner_node', table_name='reaction')
    op.drop_index('ix_reaction_file_id', table_name='reaction')
    op.drop_table('reaction')
