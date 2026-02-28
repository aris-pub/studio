"""add_annotation_highlight_fields

Revision ID: a9993a3aff56
Revises: c2c4fe54bfd7
Create Date: 2026-02-28 16:46:16.959261

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a9993a3aff56'
down_revision: Union[str, None] = 'c2c4fe54bfd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the new enum type
    annotationvisibility = sa.Enum('PRIVATE', 'SHARED', name='annotationvisibility')
    annotationvisibility.create(op.get_bind(), checkfirst=True)

    # Add new columns as nullable first (for existing rows)
    op.add_column('annotation', sa.Column('owner_id', sa.Integer(), nullable=True))
    op.add_column('annotation', sa.Column('color', sa.String(), server_default='purple', nullable=False))
    op.add_column('annotation', sa.Column(
        'visibility', annotationvisibility, server_default='PRIVATE', nullable=False
    ))
    op.add_column('annotation', sa.Column('anchor_data', sa.JSON(), nullable=True))
    op.add_column('annotation', sa.Column('selected_text', sa.Text(), nullable=True))

    # Backfill existing rows: assign to owner of the first annotation_message, or file owner
    op.execute("""
        UPDATE annotation SET
            owner_id = COALESCE(
                (SELECT owner_id FROM annotation_message WHERE annotation_message.annotation_id = annotation.id LIMIT 1),
                (SELECT owner_id FROM files WHERE files.id = annotation.file_id)
            ),
            anchor_data = '{"node_id": "0", "start_offset": 0, "end_offset": 0}'::json,
            selected_text = ''
        WHERE owner_id IS NULL
    """)

    # Now set NOT NULL constraints
    op.alter_column('annotation', 'owner_id', nullable=False)
    op.alter_column('annotation', 'anchor_data', nullable=False)
    op.alter_column('annotation', 'selected_text', nullable=False)

    op.create_foreign_key('fk_annotation_owner_id', 'annotation', 'users', ['owner_id'], ['id'])
    op.drop_column('annotation', 'type')

    # Drop the old enum type
    old_enum = sa.Enum(name='annotationtype')
    old_enum.drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Recreate old enum
    annotationtype = sa.Enum('NOTE', 'COMMENT', name='annotationtype')
    annotationtype.create(op.get_bind(), checkfirst=True)

    op.add_column('annotation', sa.Column('type', postgresql.ENUM('NOTE', 'COMMENT', name='annotationtype'), server_default='NOTE', nullable=False))
    op.drop_constraint('fk_annotation_owner_id', 'annotation', type_='foreignkey')
    op.drop_column('annotation', 'selected_text')
    op.drop_column('annotation', 'anchor_data')
    op.drop_column('annotation', 'visibility')
    op.drop_column('annotation', 'color')
    op.drop_column('annotation', 'owner_id')

    # Drop the new enum
    new_enum = sa.Enum(name='annotationvisibility')
    new_enum.drop(op.get_bind(), checkfirst=True)
