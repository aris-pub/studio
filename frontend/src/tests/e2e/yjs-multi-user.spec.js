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
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

// Second test user for multi-user scenarios
const TEST_USER2_EMAIL = "testuser2@example.com";
const TEST_USER2_PASSWORD = "testpass123";
const TEST_USER2_NAME = "Test User 2";
const TEST_USER2_INITIALS = "TU2";

// Third test user for commenter role
const TEST_USER3_EMAIL = "testuser3@example.com";
const TEST_USER3_PASSWORD = "testpass123";
const TEST_USER3_NAME = "Test User 3";
const TEST_USER3_INITIALS = "TU3";

// Helper to create authenticated session
async function createAuthenticatedPage(browser, request, email, password) {
  const loginResponse = await request.post(`${backendURL}/login`, {
    data: { email, password },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`);
  }

  const loginData = await loginResponse.json();

  const userResponse = await request.get(`${backendURL}/me`, {
    headers: { Authorization: `Bearer ${loginData.access_token}` },
  });

  if (!userResponse.ok()) {
    throw new Error(`Failed to fetch user data: ${userResponse.status()}`);
  }

  const userData = await userResponse.json();

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`/`, { waitUntil: "commit" });
  await page.evaluate(
    (data) => {
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    },
    { ...loginData, user: userData }
  );

  return { context, page, token: loginData.access_token, userId: userData.id };
}

// Helper to register a new user (or skip if already exists)
async function registerUser(request, email, name, initials, password) {
  const response = await request.post(`${backendURL}/register`, {
    data: { email, name, initials, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    // If user already exists, that's okay - we can still login
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

// Helper to open file and editor
async function openFileInEditor(page, fileId) {
  // Listen for console errors
  page.on("pageerror", (_error) => {
    // Capture page errors
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Capture console errors
    }
  });

  await page.goto(`/file/${fileId}`, { waitUntil: "commit" });

  // Wait for Vue to mount and authenticate the route
  const container = await page
    .waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 })
    .catch(() => null);

  if (!container) {
    if (page.url().includes("/login")) {
      throw new Error("Redirected to login - authentication issue");
    }
    throw new Error("Access denied or page failed to load");
  }

  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });
}

// Helper to insert text
async function insertText(page, text) {
  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
    view.dispatch({ changes: { from: pos, insert: txt } });
  }, text);

  await page.waitForFunction((txt) => window.__cmView.state.doc.toString().includes(txt), text, {
    timeout: 5000,
  });
}

// Helper to clear editor
async function clearEditor(page) {
  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
  });

  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__ytext.toString().length === 0, {}, { timeout: 5000 });
}

// Helper to get editor content
async function getEditorContent(page) {
  return await page.evaluate("window.__cmView.state.doc.toString()");
}

// Helper to wait for sync
async function waitForSync(page, expectedContent) {
  await page.waitForFunction(
    (content) => {
      const editorContent = window.__cmView?.state.doc.toString() || "";
      return editorContent.includes(content);
    },
    expectedContent,
    { timeout: 5000 }
  );
}

// Helper to add collaborator via API
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
    // If permission already exists, that's okay - we can proceed
    if (response.status === 400 && errorBody.includes("already has permission")) {
      return null;
    }
    throw new Error(`Failed to add collaborator: ${response.status} - ${errorBody}`);
  }

  const result = await response.json();
  return result;
}

// Helper to cleanup Y.js state
async function cleanupYjs(page) {
  try {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.__provider) {
          const ws = window.__provider.ws;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.addEventListener("close", () => resolve(), { once: true });
            window.__provider.disconnect();
            window.__provider.destroy();
          } else {
            window.__provider.disconnect();
            window.__provider.destroy();
            resolve();
          }
          delete window.__provider;
        } else {
          resolve();
        }

        if (window.__ydoc) {
          window.__ydoc.destroy();
          delete window.__ydoc;
        }

        delete window.__ytext;
        delete window.__awareness;
        delete window.__cmView;
      });
    });
  } catch (_error) {
    // Ignore cleanup errors
  }
}

test.describe("Multi-User Collaboration @auth", () => {
  test("should allow OWNER and EDITOR to edit simultaneously", async ({ browser, request }) => {
    test.setTimeout(60000);

    // Register second user
    await registerUser(
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_NAME,
      TEST_USER2_INITIALS,
      TEST_USER2_PASSWORD
    );

    // Owner creates session
    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );

    // Editor creates session
    const editor = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_PASSWORD
    );

    try {
      const fileId = 1;

      // Owner opens file and clears it
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      // Wait for clear to propagate to Y.js server before collaborator joins
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      // Owner adds editor as collaborator
      await addCollaborator(fileId, editor.userId, "EDITOR", owner.token);

      // Editor opens file
      await openFileInEditor(editor.page, fileId);

      // Owner types
      const ownerText = "Owner: Hello from owner\n";
      await insertText(owner.page, ownerText);
      await waitForSync(editor.page, ownerText);

      // Editor types
      const editorText = "Editor: Hello from editor\n";
      await insertText(editor.page, editorText);
      await waitForSync(owner.page, editorText);

      // Both should see both texts
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
    }
  });

  test("should allow COMMENTER to view but not edit", async ({ browser, request }) => {
    test.setTimeout(60000);

    // Register third user
    await registerUser(
      request,
      TEST_USER3_EMAIL,
      TEST_USER3_NAME,
      TEST_USER3_INITIALS,
      TEST_USER3_PASSWORD
    );

    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );
    const commenter = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER3_EMAIL,
      TEST_USER3_PASSWORD
    );

    try {
      const fileId = 1;

      // Owner prepares file
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      const ownerText = "Owner content\n";
      await insertText(owner.page, ownerText);

      // Add commenter
      await addCollaborator(fileId, commenter.userId, "COMMENTER", owner.token);

      // Commenter opens file
      await openFileInEditor(commenter.page, fileId);

      // Commenter should see owner's content
      const commenterContent = await getEditorContent(commenter.page);
      expect(commenterContent).toContain(ownerText);

      // Check if editor is read-only for commenter
      const isReadOnly = await commenter.page.evaluate(() => {
        const view = window.__cmView;
        if (!view) return null;
        // Check EditorView.editable facet
        return !view.state.facet(window.EditorView.editable);
      });

      expect(isReadOnly).toBe(true);
    } finally {
      await cleanupYjs(owner.page);
      await cleanupYjs(commenter.page);
      await owner.context.close();
      await commenter.context.close();
    }
  });

  test("should reject unauthorized user connection", async ({ browser, request }) => {
    test.setTimeout(60000);

    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );
    const unauthorized = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_PASSWORD
    );

    try {
      // Use file 2 for this test (user 2 doesn't have permission to it)
      const fileId = 2;

      // Owner opens file
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      // Unauthorized user tries to open file (no permission granted)
      // Since the file isn't in their fileStore, they should be redirected to 404

      await unauthorized.page.goto(`/file/${fileId}`, { waitUntil: "commit" });

      // Wait for Vue to process the auth check and either redirect or show error
      await unauthorized.page
        .waitForURL((url) => !url.includes(`/file/${fileId}`), { timeout: 8000 })
        .catch(() => {
          // No redirect — page stays at file URL but should not show manuscript
        });

      const currentUrl = unauthorized.page.url();
      const pageText = await unauthorized.page.textContent("body");

      // Either redirected to 404, or page shows error
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
    }
  });

  test("should persist multi-user edits to database", async ({ browser, request }) => {
    test.setTimeout(60000);

    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );
    const editor = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_PASSWORD
    );

    try {
      const fileId = 1;

      // Setup collaboration
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        { timeout: 5000 }
      );

      await addCollaborator(fileId, editor.userId, "EDITOR", owner.token);
      await openFileInEditor(editor.page, fileId);

      // Both users edit
      await insertText(owner.page, "Line from owner\n");
      await insertText(editor.page, "Line from editor\n");

      // Poll API until Y.js debounce flushes both edits to the database
      await expect
        .poll(
          async () => {
            const r = await fetch(`${backendURL}/files/${fileId}`, {
              headers: { Authorization: `Bearer ${owner.token}` },
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
    }
  });
});
