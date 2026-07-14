"""Tests for the hard-delete retention job (GDPR erasure, second stage).

hard_delete_expired_users permanently removes accounts soft-deleted longer than
the retention window, relying on the database ON DELETE cascades added by the
user_deletion_cascades migration. Those cascades are only enforced on
PostgreSQL, so these tests are skipped on SQLite.
"""

from datetime import UTC, datetime, timedelta

import pytest

from aris.crud.user import hard_delete_expired_users
from aris.models.models import (
    Annotation,
    AnnotationMessage,
    File,
    FileAsset,
    FilePermission,
    FileRole,
    FileSettings,
    FileVersion,
    ProfilePicture,
    Tag,
    User,
    UserSettings,
)


async def _file(db, owner_id, title="Doc"):
    f = File(owner_id=owner_id, source="c", title=title)
    db.add(f)
    await db.flush()
    return f


async def test_hard_delete_cascades_and_preserves_attribution(
    db_session, test_user, test_user2, is_postgresql
):
    if not is_postgresql:
        pytest.skip("DB-level ON DELETE cascade requires PostgreSQL")

    pic = ProfilePicture(filename="p.png", mime_type="image/png", content="x")
    db_session.add(pic)
    await db_session.flush()
    test_user.profile_picture_id = pic.id

    own = await _file(db_session, test_user.id)
    own_ann = Annotation(file_id=own.id, owner_id=test_user.id, anchor_data={}, selected_text="s")
    db_session.add(own_ann)
    await db_session.flush()
    owned = {
        "file": own,
        "annotation": own_ann,
        "message": AnnotationMessage(annotation_id=own_ann.id, owner_id=test_user.id, content="m"),
        "version": FileVersion(
            file_id=own.id, version_number=1, rsm_content="v", created_by=test_user.id
        ),
        "asset": FileAsset(
            filename="a.png",
            mime_type="image/png",
            content="x",
            file_id=own.id,
            owner_id=test_user.id,
        ),
        "settings": FileSettings(user_id=test_user.id, file_id=own.id),
        "permission": FilePermission(
            file_id=own.id,
            user_id=test_user.id,
            role=FileRole.OWNER,
            granted_by=test_user.id,
        ),
        "tag": Tag(user_id=test_user.id, name="t", color="blue"),
        "user_settings": UserSettings(user_id=test_user.id),
    }
    for row in owned.values():
        db_session.add(row)

    # contributions to another account's file: must survive, attribution nulled
    shared = await _file(db_session, test_user2.id, title="Shared")
    surviving_version = FileVersion(
        file_id=shared.id, version_number=1, rsm_content="v", created_by=test_user.id
    )
    surviving_asset = FileAsset(
        filename="c.png",
        mime_type="image/png",
        content="x",
        file_id=shared.id,
        owner_id=test_user.id,
    )
    db_session.add_all([surviving_version, surviving_asset])
    await db_session.commit()

    models = {
        "file": File,
        "annotation": Annotation,
        "message": AnnotationMessage,
        "version": FileVersion,
        "asset": FileAsset,
        "settings": FileSettings,
        "permission": FilePermission,
        "tag": Tag,
        "user_settings": UserSettings,
    }
    owned_ids = {k: owned[k].id for k in models}
    pic_id, tu_id, tu2_id = pic.id, test_user.id, test_user2.id
    shared_id, sv_id, sa_id = shared.id, surviving_version.id, surviving_asset.id

    # age the soft delete past the retention window
    old = datetime.now(UTC) - timedelta(days=31)
    test_user.deleted_at = old
    pic.deleted_at = old
    await db_session.commit()

    result = await hard_delete_expired_users(db_session, retention_days=30)
    assert result["users"] == 1
    assert result["profile_pictures"] == 1

    db_session.expunge_all()

    assert await db_session.get(User, tu_id) is None
    assert await db_session.get(ProfilePicture, pic_id) is None
    for key, model in models.items():
        assert await db_session.get(model, owned_ids[key]) is None, f"{key} survived"

    # the other account, its file, and the survived contributions remain
    assert await db_session.get(User, tu2_id) is not None
    assert await db_session.get(File, shared_id) is not None

    sv = await db_session.get(FileVersion, sv_id)
    assert sv is not None and sv.created_by is None
    sa = await db_session.get(FileAsset, sa_id)
    assert sa is not None and sa.owner_id is None


async def test_hard_delete_respects_retention_window(db_session, test_user, is_postgresql):
    if not is_postgresql:
        pytest.skip("DB-level ON DELETE cascade requires PostgreSQL")

    test_user.deleted_at = datetime.now(UTC) - timedelta(days=5)
    await db_session.commit()
    tu_id = test_user.id

    result = await hard_delete_expired_users(db_session, retention_days=30)
    assert result["users"] == 0

    db_session.expunge_all()
    assert await db_session.get(User, tu_id) is not None


async def test_hard_delete_ignores_live_accounts(db_session, test_user, is_postgresql):
    if not is_postgresql:
        pytest.skip("DB-level ON DELETE cascade requires PostgreSQL")

    tu_id = test_user.id
    result = await hard_delete_expired_users(db_session, retention_days=30)
    assert result["users"] == 0

    db_session.expunge_all()
    assert await db_session.get(User, tu_id) is not None
