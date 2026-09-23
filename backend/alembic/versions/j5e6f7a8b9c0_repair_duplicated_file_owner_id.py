"""Repair files whose owner_id points at someone with no permission on them

Until this release, duplicating a file copied the original's owner_id onto the
copy while the OWNER permission row went to the user who asked for the copy.
Those two disagreeing let the original owner keep reading the copy through
GET /files, which returns the manuscript source, and misrouted the owner_id
checks in crud/file_settings.py and crud/tag.py.

This points owner_id at the file's actual OWNER permission row wherever the two
disagree. Files whose owner_id already matches an undeleted OWNER row, and files
with no OWNER row or more than one, are left alone.

There is no downgrade: the old values were wrong and are not worth restoring.

Revision ID: j5e6f7a8b9c0
Revises: i4d5e6f7a8b9
Create Date: 2026-09-22

"""

from alembic import op


revision = "j5e6f7a8b9c0"
down_revision = "i4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Point owner_id at the single undeleted OWNER permission row, where one exists."""
    op.execute(
        """
        UPDATE files f
        SET owner_id = sole.user_id
        FROM (
            SELECT file_id, MIN(user_id) AS user_id
            FROM file_permissions
            WHERE role = 'OWNER' AND deleted_at IS NULL
            GROUP BY file_id
            HAVING COUNT(*) = 1
        ) AS sole
        WHERE f.id = sole.file_id
          AND f.deleted_at IS NULL
          AND f.owner_id IS DISTINCT FROM sole.user_id
        """
    )


def downgrade() -> None:
    """No downgrade: the previous owner_id values were incorrect."""
    pass
