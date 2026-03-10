/**
 * @file E2E tests for shared annotation layer
 * @tags @auth @annotations @shared
 *
 * Tests the shared annotation system: visibility rules, share flow,
 * threaded comments, deletion permissions, and irreversibility.
 *
 * Annotations are created via API for reliability (text selection in
 * Playwright is fragile). UI assertions verify rendering and interaction.
 */

import { test, expect } from "../fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
} from "../yjs-helpers.js";
import { getBackendURL } from "../utils/test-config.js";

const backendURL = getBackendURL();

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

const COLLAB_EMAIL = "annot-collab@example.com";
const COLLAB_PASSWORD = "testpass123";
const COLLAB_NAME = "Annotation Collaborator";
const COLLAB_INITIALS = "AC";

async function registerUser(request, email, name, initials, password) {
  const response = await request.post(`${backendURL}/register`, {
    data: { email, name, initials, password },
  });
  if (!response.ok()) {
    const body = await response.text();
    if (response.status() === 409 || body.includes("already")) return null;
    throw new Error(`Registration failed: ${response.status()} ${body}`);
  }
  return await response.json();
}

async function addCollaborator(fileId, userId, role, token) {
  const response = await fetch(`${backendURL}/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, role }),
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 400 && body.includes("already has permission")) return null;
    throw new Error(`Failed to add collaborator: ${response.status} - ${body}`);
  }
  return await response.json();
}

async function createAnnotation(request, token, fileId, opts = {}) {
  const response = await request.post(`${backendURL}/annotations/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      file_id: fileId,
      color: opts.color || "purple",
      anchor_data: opts.anchor_data || {
        node_id: "test-node",
        start_offset: 0,
        end_offset: 10,
      },
      selected_text: opts.selected_text || "test highlight",
      visibility: opts.visibility || "private",
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create annotation: ${response.status()} ${await response.text()}`);
  }
  return await response.json();
}

async function addMessage(request, token, annotationId, content) {
  const response = await request.post(`${backendURL}/annotations/${annotationId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { content },
  });
  if (!response.ok()) {
    throw new Error(`Failed to add message: ${response.status()} ${await response.text()}`);
  }
  return await response.json();
}

async function updateAnnotation(request, token, annotationId, data) {
  const response = await request.put(`${backendURL}/annotations/${annotationId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return response;
}

async function deleteAnnotation(request, token, annotationId) {
  return await request.delete(`${backendURL}/annotations/${annotationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function openFileInViewer(page, fileId) {
  await page.goto(`/file/${fileId}`, { waitUntil: "commit" });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 });
}

test.describe("Shared Annotations E2E @auth @annotations", () => {
  let ownerAuth, collabAuth;
  let fileId;

  test.beforeAll(async ({ request }) => {
    await registerUser(request, COLLAB_EMAIL, COLLAB_NAME, COLLAB_INITIALS, COLLAB_PASSWORD);
    [ownerAuth, collabAuth] = await Promise.all([
      loginUser(request, TEST_USER_EMAIL, TEST_USER_PASSWORD),
      loginUser(request, COLLAB_EMAIL, COLLAB_PASSWORD),
    ]);
  });

  test.beforeEach(async ({ request }) => {
    // Create a file with content and share with collaborator
    fileId = await createTestFile(
      request,
      ownerAuth.token,
      ownerAuth.userData.id,
      "# Test Document\n\nThis is a paragraph with some text for annotations."
    );
    await addCollaborator(fileId, collabAuth.userData.id, "EDITOR", ownerAuth.token);
  });

  test.afterEach(async ({ request }) => {
    if (fileId) await deleteTestFile(request, ownerAuth.token, fileId).catch(() => {});
  });

  // ─── Visibility ─────────────────────────────────────────────────────────────

  test("private annotation visible only to owner, not collaborator", async ({
    request,
    browser,
  }) => {
    test.setTimeout(45000);

    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "private",
      selected_text: "private highlight",
    });

    // Owner sees it
    const owner = await createAuthenticatedContext(browser, ownerAuth);
    try {
      await openFileInViewer(owner.page, fileId);
      await expect(owner.page.locator(`[data-card-id="${annotation.id}"]`)).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await owner.context.close();
    }

    // Collaborator does NOT see it
    const collab = await createAuthenticatedContext(browser, collabAuth);
    try {
      await openFileInViewer(collab.page, fileId);
      await expect(collab.page.locator(`[data-card-id="${annotation.id}"]`)).not.toBeVisible({
        timeout: 5000,
      });
    } finally {
      await collab.context.close();
    }
  });

  test("shared annotation visible to collaborator", async ({ request, browser }) => {
    test.setTimeout(45000);

    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
      selected_text: "shared highlight",
    });

    const collab = await createAuthenticatedContext(browser, collabAuth);
    try {
      await openFileInViewer(collab.page, fileId);
      const card = collab.page.locator(`[data-card-id="${annotation.id}"]`);
      await expect(card).toBeVisible({ timeout: 10000 });
      await expect(card).toHaveClass(/shared/);
    } finally {
      await collab.context.close();
    }
  });

  // ─── Share flow (two-click) ─────────────────────────────────────────────────

  test("owner can share private annotation via two-click confirmation", async ({
    request,
    browser,
  }) => {
    test.setTimeout(45000);

    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "private",
    });

    const owner = await createAuthenticatedContext(browser, ownerAuth);
    try {
      await openFileInViewer(owner.page, fileId);
      const card = owner.page.locator(`[data-card-id="${annotation.id}"]`);
      await expect(card).toBeVisible({ timeout: 10000 });

      // Card should NOT have shared class yet
      await expect(card).not.toHaveClass(/shared/);

      // Hover to reveal action buttons
      await card.hover();

      // First click: arms the share button
      const shareBtn = card.locator('button[aria-label="Share annotation"]');
      await expect(shareBtn).toBeVisible();
      await shareBtn.click();

      // Confirm button appears
      const confirmBtn = card.locator('button[aria-label="Confirm share"]');
      await expect(confirmBtn).toBeVisible();

      // Wait for debounce (400ms)
      await owner.page.waitForTimeout(500);

      // Second click: confirms — wait for the PUT to complete
      const [putResponse] = await Promise.all([
        owner.page.waitForResponse(
          (r) => r.url().includes("/annotations/") && r.request().method() === "PUT"
        ),
        confirmBtn.click(),
      ]);
      expect(putResponse.ok()).toBe(true);
      const putBody = await putResponse.json();
      expect(putBody.visibility).toBe("shared");

      // Card should now have shared class
      await expect(card).toHaveClass(/shared/, { timeout: 10000 });
    } finally {
      await owner.context.close();
    }
  });

  // ─── Shared card UI ─────────────────────────────────────────────────────────

  test("shared annotation card shows author avatar and Shared label", async ({
    request,
    browser,
  }) => {
    test.setTimeout(45000);

    await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
      selected_text: "labeled highlight",
    });

    const collab = await createAuthenticatedContext(browser, collabAuth);
    try {
      await openFileInViewer(collab.page, fileId);
      const card = collab.page.locator(".note.shared").first();
      await expect(card).toBeVisible({ timeout: 10000 });

      // Should show "Shared" label
      await expect(card.locator(".shared-label")).toHaveText("Shared");

      // Should show author avatar in header
      await expect(card.locator(".header .av-wrapper")).toBeVisible();
    } finally {
      await collab.context.close();
    }
  });

  // ─── Thread replies ─────────────────────────────────────────────────────────

  test("active shared annotation shows reply input, can post replies", async ({
    request,
    browser,
  }) => {
    test.setTimeout(45000);

    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
      selected_text: "thread test",
    });
    await addMessage(request, ownerAuth.token, annotation.id, "First note from owner");

    const collab = await createAuthenticatedContext(browser, collabAuth);
    try {
      await openFileInViewer(collab.page, fileId);
      const card = collab.page.locator(`[data-card-id="${annotation.id}"]`);
      await expect(card).toBeVisible({ timeout: 10000 });

      // Reply input should NOT be visible before card is active
      await expect(card.locator(".reply-input")).not.toBeVisible();

      // Click to activate
      await card.click();

      // Reply input should now be visible
      const replyInput = card.locator(".reply-input");
      await expect(replyInput).toBeVisible({ timeout: 5000 });

      // Type and submit a reply
      await replyInput.fill("Reply from collaborator");
      await replyInput.press("Enter");

      // Should see two threaded messages now (owner's + collab's)
      await expect(card.locator(".message--threaded")).toHaveCount(2, { timeout: 5000 });

      // Reply input should be cleared
      await expect(replyInput).toHaveValue("");
    } finally {
      await collab.context.close();
    }
  });

  test("threaded messages each show author avatar", async ({ request, browser }) => {
    test.setTimeout(45000);

    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
    });
    await addMessage(request, ownerAuth.token, annotation.id, "Owner's note");
    await addMessage(request, collabAuth.token, annotation.id, "Collaborator's reply");

    const owner = await createAuthenticatedContext(browser, ownerAuth);
    try {
      await openFileInViewer(owner.page, fileId);
      const card = owner.page.locator(`[data-card-id="${annotation.id}"]`);
      await expect(card).toBeVisible({ timeout: 10000 });

      // Each threaded message should have its own avatar
      const messages = card.locator(".message--threaded");
      await expect(messages).toHaveCount(2);
      await expect(messages.nth(0).locator(".av-wrapper")).toBeVisible();
      await expect(messages.nth(1).locator(".av-wrapper")).toBeVisible();
    } finally {
      await owner.context.close();
    }
  });

  // ─── Irreversibility ────────────────────────────────────────────────────────

  test("shared annotation cannot be made private again (API)", async ({ request }) => {
    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
    });

    const response = await updateAnnotation(request, ownerAuth.token, annotation.id, {
      visibility: "private",
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain("cannot be made private");
  });

  // ─── Deletion rules ─────────────────────────────────────────────────────────

  test("owner can delete own shared annotation without notes", async ({ request }) => {
    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
    });

    const response = await deleteAnnotation(request, ownerAuth.token, annotation.id);
    expect(response.status()).toBe(204);
  });

  test("collaborator cannot delete shared annotation with notes (only file owner can)", async ({
    request,
  }) => {
    // Collab creates a shared annotation
    const annotation = await createAnnotation(request, collabAuth.token, fileId, {
      visibility: "shared",
    });
    // Add a note to it
    await addMessage(request, collabAuth.token, annotation.id, "A note");

    // Another reply from owner makes it a real thread
    await addMessage(request, ownerAuth.token, annotation.id, "Owner reply");

    // Collab (annotation owner) tries to delete — should fail because it has notes
    // and collab is not the file owner
    const collabDeleteResponse = await deleteAnnotation(request, collabAuth.token, annotation.id);
    expect(collabDeleteResponse.status()).toBe(403);

    // File owner CAN delete it
    const ownerDeleteResponse = await deleteAnnotation(request, ownerAuth.token, annotation.id);
    expect(ownerDeleteResponse.status()).toBe(204);
  });

  test("non-owner cannot delete another user's annotation", async ({ request }) => {
    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
    });

    const response = await deleteAnnotation(request, collabAuth.token, annotation.id);
    expect(response.status()).toBe(403);
  });

  // ─── Private annotation single-note limit ──────────────────────────────────

  test("private annotation limited to single note", async ({ request }) => {
    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "private",
    });
    await addMessage(request, ownerAuth.token, annotation.id, "First note");

    // Second note should fail
    const response = await request.post(`${backendURL}/annotations/${annotation.id}/messages`, {
      headers: { Authorization: `Bearer ${ownerAuth.token}` },
      data: { content: "Second note" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain("already has a note");
  });

  test("shared annotation allows multiple messages (thread)", async ({ request }) => {
    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
    });
    await addMessage(request, ownerAuth.token, annotation.id, "First message");
    await addMessage(request, collabAuth.token, annotation.id, "Second message");
    await addMessage(request, ownerAuth.token, annotation.id, "Third message");

    // Fetch annotation and verify all 3 messages
    const response = await request.get(`${backendURL}/annotations/${annotation.id}`, {
      headers: { Authorization: `Bearer ${ownerAuth.token}` },
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.messages).toHaveLength(3);
  });

  // ─── Message owner info ─────────────────────────────────────────────────────

  test("message response includes owner info", async ({ request }) => {
    const annotation = await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
    });
    const message = await addMessage(request, ownerAuth.token, annotation.id, "A note");

    expect(message.owner).toBeDefined();
    expect(message.owner.id).toBe(ownerAuth.userData.id);
    expect(message.owner.name).toBeTruthy();
  });

  // ─── Edit/delete buttons visibility ─────────────────────────────────────────

  test("collaborator cannot see edit/delete buttons on other user's annotation", async ({
    request,
    browser,
  }) => {
    test.setTimeout(45000);

    await createAnnotation(request, ownerAuth.token, fileId, {
      visibility: "shared",
      selected_text: "owner's shared",
    });

    const collab = await createAuthenticatedContext(browser, collabAuth);
    try {
      await openFileInViewer(collab.page, fileId);
      const card = collab.page.locator(".note.shared").first();
      await expect(card).toBeVisible({ timeout: 10000 });

      // Hover to try to reveal buttons
      await card.hover();

      // Edit and delete buttons should NOT be visible (not own annotation)
      await expect(card.locator('button[aria-label="Edit annotation"]')).not.toBeVisible();
      await expect(card.locator('button[aria-label="Delete annotation"]')).not.toBeVisible();
    } finally {
      await collab.context.close();
    }
  });
});
