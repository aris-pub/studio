/**
 * E2E tests for Y.js MULTI-USER COLLABORATION WITH PERMISSIONS
 *
 * Tests that multiple different users can collaborate on the same file
 * with proper permission enforcement (OWNER/EDITOR/COMMENTER).
 *
 * Tag: @auth
 *
 * Scope: studio-q5r (Multi-user collaboration with permissions)
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  insertText,
  clearEditor,
  getEditorContent,
  waitForSync,
  cleanupYjs,
} from "./yjs-helpers.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

const TEST_USER2_EMAIL = "testuser2@example.com";
const TEST_USER2_PASSWORD = "testpass123";
const TEST_USER2_NAME = "Test User 2";
const TEST_USER2_INITIALS = "TU2";

const TEST_USER3_EMAIL = "testuser3@example.com";
const TEST_USER3_PASSWORD = "testpass123";
const TEST_USER3_NAME = "Test User 3";
const TEST_USER3_INITIALS = "TU3";

async function registerUser(request, email, name, initials, password) {
  const response = await request.post(`${backendURL}/register`, {
    data: { email, name, initials, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    if (
      response.status() === 409 ||
      body.includes("already registered") ||
      body.includes("already exists")
    ) {
      return null;
    }
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
    const errorBody = await response.text();
    if (response.status === 400 && errorBody.includes("already has permission")) {
      return null;
    }
    throw new Error(`Failed to add collaborator: ${response.status} - ${errorBody}`);
  }

  return await response.json();
}

test.describe("Multi-User Collaboration @auth", () => {
  let ownerAuth, editorAuth, commenterAuth;

  test.beforeAll(async ({ request }) => {
    await Promise.all([
      registerUser(
        request,
        TEST_USER2_EMAIL,
        TEST_USER2_NAME,
        TEST_USER2_INITIALS,
        TEST_USER2_PASSWORD
      ),
      registerUser(
        request,
        TEST_USER3_EMAIL,
        TEST_USER3_NAME,
        TEST_USER3_INITIALS,
        TEST_USER3_PASSWORD
      ),
    ]);

    // Login all users via HTTP only — no browser contexts yet.
    // Browser contexts are created per-test AFTER addCollaborator so that
    // fileStore.loadFiles() runs with the permission already in the database.
    [ownerAuth, editorAuth, commenterAuth] = await Promise.all([
      loginUser(request, TEST_USER_EMAIL, TEST_USER_PASSWORD),
      loginUser(request, TEST_USER2_EMAIL, TEST_USER2_PASSWORD),
      loginUser(request, TEST_USER3_EMAIL, TEST_USER3_PASSWORD),
    ]);
  });

  test("should allow OWNER and EDITOR to edit simultaneously", async ({ browser, request }) => {
    test.setTimeout(60000);

    const fileId = await createTestFile(request, ownerAuth.token, ownerAuth.userData.id);
    await addCollaborator(fileId, editorAuth.userData.id, "EDITOR", ownerAuth.token);

    const owner = await createAuthenticatedContext(browser, ownerAuth);
    const editor = await createAuthenticatedContext(browser, editorAuth);

    try {
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      await openFileInEditor(editor.page, fileId);

      const ownerText = "Owner: Hello from owner\n";
      await insertText(owner.page, ownerText);
      await waitForSync(editor.page, ownerText);

      const editorText = "Editor: Hello from editor\n";
      await insertText(editor.page, editorText);
      await waitForSync(owner.page, editorText);

      const ownerContent = await getEditorContent(owner.page);
      const editorContent = await getEditorContent(editor.page);

      expect(ownerContent).toContain(ownerText);
      expect(ownerContent).toContain(editorText);
      expect(editorContent).toContain(ownerText);
      expect(editorContent).toContain(editorText);
      expect(ownerContent).toBe(editorContent);
    } finally {
      await cleanupYjs(owner.page);
      await cleanupYjs(editor.page);
      await owner.context.close();
      await editor.context.close();
      await deleteTestFile(request, ownerAuth.token, fileId);
    }
  });

  test("should allow COMMENTER to view but not edit", async ({ browser, request }) => {
    test.setTimeout(60000);

    const fileId = await createTestFile(request, ownerAuth.token, ownerAuth.userData.id);
    await addCollaborator(fileId, commenterAuth.userData.id, "COMMENTER", ownerAuth.token);

    const owner = await createAuthenticatedContext(browser, ownerAuth);
    const commenter = await createAuthenticatedContext(browser, commenterAuth);

    try {
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      const ownerText = "Owner content\n";
      await insertText(owner.page, ownerText);

      await openFileInEditor(commenter.page, fileId);
      await waitForSync(commenter.page, ownerText);

      const commenterContent = await getEditorContent(commenter.page);
      expect(commenterContent).toContain(ownerText);

      const isReadOnly = await commenter.page.evaluate(() => {
        const view = window.__cmView;
        if (!view) return null;
        return !view.state.facet(window.EditorView.editable);
      });

      expect(isReadOnly).toBe(true);
    } finally {
      await cleanupYjs(owner.page);
      await cleanupYjs(commenter.page);
      await owner.context.close();
      await commenter.context.close();
      await deleteTestFile(request, ownerAuth.token, fileId);
    }
  });

  test("should reject unauthorized user connection", async ({ browser, request }) => {
    test.setTimeout(60000);

    // Create a file and intentionally do NOT grant editorAuth any permission.
    // editorAuth's fileStore will not include this file, so WorkspaceView redirects to /404.
    const fileId = await createTestFile(request, ownerAuth.token, ownerAuth.userData.id);

    const owner = await createAuthenticatedContext(browser, ownerAuth);
    const unauthorized = await createAuthenticatedContext(browser, editorAuth);

    try {
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      await unauthorized.page.goto(`/file/${fileId}`, { waitUntil: "commit" });

      await unauthorized.page
        .waitForURL((url) => !url.includes(`/file/${fileId}`), { timeout: 8000 })
        .catch(() => {});

      const currentUrl = unauthorized.page.url();
      const pageText = await unauthorized.page.textContent("body");

      const isUnauthorized =
        currentUrl.includes("/404") ||
        pageText.includes("404") ||
        pageText.includes("not found") ||
        !(await unauthorized.page.locator('[data-testid="manuscript-container"]').isVisible());

      expect(isUnauthorized).toBe(true);
    } finally {
      await cleanupYjs(owner.page);
      try {
        await cleanupYjs(unauthorized.page);
      } catch (_e) {
        // May fail if page didn't load
      }
      await owner.context.close();
      await unauthorized.context.close();
      await deleteTestFile(request, ownerAuth.token, fileId);
    }
  });

  test("should persist multi-user edits to database", async ({ browser, request }) => {
    test.setTimeout(60000);

    const fileId = await createTestFile(request, ownerAuth.token, ownerAuth.userData.id);
    await addCollaborator(fileId, editorAuth.userData.id, "EDITOR", ownerAuth.token);

    const owner = await createAuthenticatedContext(browser, ownerAuth);
    const editor = await createAuthenticatedContext(browser, editorAuth);

    try {
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      await openFileInEditor(editor.page, fileId);

      await insertText(owner.page, "Line from owner\n");
      await insertText(editor.page, "Line from editor\n");

      // Poll API until Y.js debounce flushes both edits to the database
      await expect
        .poll(
          async () => {
            const r = await fetch(`${backendURL}/files/${fileId}`, {
              headers: { Authorization: `Bearer ${ownerAuth.token}` },
            });
            const data = await r.json();
            const source = data.source ?? "";
            return source.includes("Line from owner") && source.includes("Line from editor");
          },
          { timeout: 10000 }
        )
        .toBe(true);
    } finally {
      await cleanupYjs(owner.page);
      await cleanupYjs(editor.page);
      await owner.context.close();
      await editor.context.close();
      await deleteTestFile(request, ownerAuth.token, fileId);
    }
  });
});
