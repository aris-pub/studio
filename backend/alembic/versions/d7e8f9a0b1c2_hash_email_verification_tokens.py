"""null out plaintext email verification tokens (std-v04t)

Email verification tokens are now stored as a SHA-256 hash, not plaintext. Any
token written before this change is plaintext and can no longer be matched (the
verify endpoint hashes the incoming token before lookup), so it is already dead.
Null those rows so no plaintext token remains at rest. Affected users can request
a new verification email. Data-only, no schema change.

Revision ID: d7e8f9a0b1c2
Revises: q2f3a4b5c6d7
Create Date: 2026-10-08
"""

from alembic import op


revision = "d7e8f9a0b1c2"
down_revision = "q2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE users SET email_verification_token = NULL "
        "WHERE email_verification_token IS NOT NULL"
    )


def downgrade():
    # Irreversible: the discarded plaintext tokens are intentionally not restorable.
    pass
