"""Tests for the account-deletion cascade (GDPR right-to-erasure).

soft_delete_user must mark deleted_at not only on the user row but on every
table that holds the account's personal data, while leaving other users'
data (and the user's contributions to other people's files) untouched.
"""

from aris.crud.user import soft_delete_user
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
    Signup,
    Tag,
    UserSettings,
)


async def _make_file(db_session, owner_id, title="Doc"):
    f = File(owner_id=owner_id, source="content", title=title)
    db_session.add(f)
    await db_session.flush()
    return f


async def test_soft_delete_user_cascades_to_all_personal_data(db_session, test_user, test_user2):
    pic = ProfilePicture(filename="me.png", mime_type="image/png", content="x")
    db_session.add(pic)
    await db_session.flush()
    test_user.profile_picture_id = pic.id

    owned_file = await _make_file(db_session, test_user.id)

    annotation = Annotation(
        file_id=owned_file.id,
        owner_id=test_user.id,
        anchor_data={"start": 0, "end": 4},
        selected_text="text",
    )
    db_session.add(annotation)
    await db_session.flush()

    rows = {
        "user_settings": UserSettings(user_id=test_user.id),
        "tag": Tag(user_id=test_user.id, name="physics", color="blue"),
        "file_asset": FileAsset(
            filename="a.png",
            mime_type="image/png",
            content="x",
            file_id=owned_file.id,
            owner_id=test_user.id,
        ),
        "file_version": FileVersion(
            file_id=owned_file.id,
            version_number=1,
            rsm_content="v1",
            created_by=test_user.id,
        ),
        "file_settings": FileSettings(user_id=test_user.id, file_id=owned_file.id),
        "annotation": annotation,
        "annotation_message": AnnotationMessage(
            annotation_id=annotation.id, owner_id=test_user.id, content="a note"
        ),
        "file_permission": FilePermission(
            file_id=owned_file.id,
            user_id=test_user.id,
            role=FileRole.OWNER,
            granted_by=test_user.id,
        ),
        "profile_picture": pic,
        "file": owned_file,
    }
    for row in rows.values():
        db_session.add(row)
    # signups have no deleted_at column and are hard-deleted; track by id
    signup = Signup(email=test_user.email, unsubscribe_token=f"tok-{test_user.email}")
    db_session.add(signup)
    await db_session.commit()
    signup_id = signup.id

    deleted = await soft_delete_user(test_user.id, db_session)
    assert deleted.deleted_at is not None

    for name, row in rows.items():
        await db_session.refresh(row)
        assert row.deleted_at is not None, f"{name} was not soft-deleted"

    assert await db_session.get(Signup, signup_id) is None, "signup not hard-deleted"


async def test_soft_delete_user_leaves_other_users_data_untouched(
    db_session, test_user, test_user2
):
    other_file = await _make_file(db_session, test_user2.id, title="Theirs")
    control = {
        "user_settings": UserSettings(user_id=test_user2.id),
        "tag": Tag(user_id=test_user2.id, name="chem", color="red"),
        "file": other_file,
        "file_permission": FilePermission(
            file_id=other_file.id,
            user_id=test_user2.id,
            role=FileRole.OWNER,
            granted_by=test_user2.id,
        ),
    }
    # give test_user something so the delete has work to do
    db_session.add(UserSettings(user_id=test_user.id))
    for row in control.values():
        db_session.add(row)
    other_signup = Signup(email=test_user2.email, unsubscribe_token=f"tok-{test_user2.email}")
    db_session.add(other_signup)
    await db_session.commit()
    other_signup_id = other_signup.id

    await soft_delete_user(test_user.id, db_session)

    for name, row in control.items():
        await db_session.refresh(row)
        assert row.deleted_at is None, f"another user's {name} was wrongly deleted"

    assert await db_session.get(Signup, other_signup_id) is not None, (
        "another user's signup was wrongly deleted"
    )


async def test_soft_delete_user_preserves_uploads_on_other_peoples_files(
    db_session, test_user, test_user2
):
    """Assets a user uploaded onto someone else's file must survive account
    deletion: owner_id is attribution only (ON DELETE SET NULL)."""
    other_file = await _make_file(db_session, test_user2.id, title="Shared")
    shared_asset = FileAsset(
        filename="contrib.png",
        mime_type="image/png",
        content="x",
        file_id=other_file.id,
        owner_id=test_user.id,
    )
    db_session.add(shared_asset)
    await db_session.commit()

    await soft_delete_user(test_user.id, db_session)

    await db_session.refresh(shared_asset)
    assert shared_asset.deleted_at is None
