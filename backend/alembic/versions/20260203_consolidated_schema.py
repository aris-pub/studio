"""Consolidated initial schema

Revision ID: 20260203_consolidated_schema
Revises: 
Create Date: 2026-02-03

This migration consolidates all previous migrations into a single base migration.
It will only create tables if they don't already exist (idempotent).

Archived migrations (removed the dangerous DELETE statement):
- a8bcc7a54da2_initial_schema
- 404696bbbd65_support_default_file_settings  
- 358cb873fb7e_add_annotation_model
- 369a8fbaa6f0_add_signup_table
- 9fe3d6fca545_add_unsubscribe_token
- 14808df09e7d_add_email_tracking_fields
- 8927a9754c0b_add_user_settings_table
- f16cfc973685_add_user_affiliation
- fcc9ed287b43_add_publication_status_fields
- remove_publication_fields (REMOVED DELETE STATEMENT)
- 59878b55c0bc_add_version_fields
- 7b34401c55b7_merge_branches
- daf48d360ee5_update_signup_table
- 8e1299cafca1_add_content_encoding

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '20260203_consolidated_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - idempotent, safe to run on existing databases."""
    # This migration represents the consolidated state of all previous migrations.
    # For existing databases that already have these tables, this is a no-op.
    # New databases will get the full schema created from scratch.
    
    # Check if tables already exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'users' in existing_tables:
        # Database already has schema, skip creation
        print("Tables already exist, skipping schema creation")
        return

    # Create enums (if not exists)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'avatarcolor') THEN
                CREATE TYPE avatarcolor AS ENUM ('BLUE', 'RED', 'GREEN', 'PURPLE', 'ORANGE', 'PINK', 'YELLOW');
            END IF;
        END$$;
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'filestatus') THEN
                CREATE TYPE filestatus AS ENUM ('DRAFT');
            END IF;
        END$$;
    """)
    
    # Create all tables (full consolidated schema)
    # Profile pictures
    op.create_table(
        'profile_pictures',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('mime_type', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('initials', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('avatar_color', postgresql.ENUM('BLUE', 'RED', 'GREEN', 'PURPLE', 'ORANGE', 'PINK', 'YELLOW', name='avatarcolor', create_type=False), nullable=True),
        sa.Column('profile_picture_id', sa.Integer(), nullable=True),
        sa.Column('email_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.ForeignKeyConstraint(['profile_picture_id'], ['profile_pictures.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    
    # Tags
    op.create_table(
        'tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'owner_id', name='uq_tag_name_owner')
    )
    
    # Files
    op.create_table(
        'files',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('abstract', sa.Text(), nullable=True),
        sa.Column('keywords', sa.String(), nullable=True),
        sa.Column('status', postgresql.ENUM('DRAFT', name='filestatus', create_type=False), nullable=False),
        sa.Column('last_edited_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('source', sa.Text(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), server_default='0', nullable=False),
        sa.Column('prev_version_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.ForeignKeyConstraint(['prev_version_id'], ['files.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_files_version', 'files', ['version'])
    op.create_index('ix_files_prev_version_id', 'files', ['prev_version_id'])
    
    # File settings
    op.create_table(
        'file_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('preamble', sa.Text(), nullable=True),
        sa.Column('apa_enabled', sa.Boolean(), nullable=True),
        sa.Column('header_enabled', sa.Boolean(), nullable=True),
        sa.Column('line_numbers_enabled', sa.Boolean(), nullable=True),
        sa.Column('latex_export_enabled', sa.Boolean(), nullable=True),
        sa.Column('word_export_enabled', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_id')
    )
    
    # File tags
    op.create_table(
        'file_tags',
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('file_id', 'tag_id')
    )
    
    # File assets
    op.create_table(
        'file_assets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('mime_type', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_encoding', sa.String(), server_default='plain', nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Annotations
    op.create_table(
        'annotation',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('node_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['files.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Annotation messages
    op.create_table(
        'annotation_message',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('annotation_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['annotation_id'], ['annotation.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Signups
    op.create_table(
        'signups',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('affiliation', sa.String(), nullable=True),
        sa.Column('use_case', sa.Text(), nullable=True),
        sa.Column('signup_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('invited', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('invited_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('email_sent', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('email_sent_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('unsubscribe_token', sa.String(), nullable=True),
        sa.Column('unsubscribed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('unsubscribe_token')
    )
    
    # User settings
    op.create_table(
        'user_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('theme', sa.String(), server_default='light', nullable=True),
        sa.Column('notifications_enabled', sa.Boolean(), server_default='true', nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop all tables in reverse order
    op.drop_table('user_settings')
    op.drop_table('signups')
    op.drop_table('annotation_message')
    op.drop_table('annotation')
    op.drop_table('file_assets')
    op.drop_table('file_tags')
    op.drop_table('file_settings')
    op.drop_table('files')
    op.drop_table('tags')
    op.drop_table('users')
    op.drop_table('profile_pictures')
    
    # Drop enums
    op.execute('DROP TYPE filestatus')
    op.execute('DROP TYPE avatarcolor')
