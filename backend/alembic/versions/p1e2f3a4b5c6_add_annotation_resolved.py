"""Add annotation resolved_at and resolved_by

Resolve becomes a distinct, reversible state separate from delete. resolved_at
marks a thread settled and hidden by default but kept, and resolved_by records
who resolved it (attribution only, ON DELETE SET NULL like the other actor
columns) so GDPR erasure anonymizes rather than orphans. std-9325.

Revision ID: p1e2f3a4b5c6
Revises: o0d1e2f3a4b5
Create Date: 2026-09-29
"""

import sqlalchemy as sa

from alembic import op


revision = "p1e2f3a4b5c6"
down_revision = "o0d1e2f3a4b5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "annotation", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("annotation", sa.Column("resolved_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_annotation_resolved_by_users",
        "annotation",
        "users",
        ["resolved_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint(
        "fk_annotation_resolved_by_users", "annotation", type_="foreignkey"
    )
    op.drop_column("annotation", "resolved_by")
    op.drop_column("annotation", "resolved_at")
