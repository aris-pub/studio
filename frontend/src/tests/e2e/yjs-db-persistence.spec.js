/**
 * E2E tests for Y.js DATABASE PERSISTENCE
 *
 * Tests that Y.js edits are persisted to PostgreSQL files.source and restored on reconnect.
 * Verifies backend-as-client architecture saves changes to database.
 *
 * Tag: @auth
 *
 * Scope: DB persistence for Y.js collaboration
 */

import { test, expect } from "./fixtures.js";

const backendURL = process.env.VITE_API_BASE_URL;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

// Helper to create authenticated session
async function createAuthenticatedPage(browser, request) {
  const loginResponse = await request.post(`${backendURL}/login`, {
    data: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
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

  await page.goto(`/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (data) => {
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    },
    { ...loginData, user: userData }
  );

  return { context, page, token: loginData.access_token };
}

// Helper to open file and editor
async function openFileInEditor(page, fileId) {
  await page.goto(`/file/${fileId}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });

  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

  // Wait for Y.js provider to be synced
  await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });
}

// Helper to get editor content
async function getEditorContent(page) {
  return await page.evaluate("window.__cmView.state.doc.toString()");
}

// Helper to insert text programmatically
async function insertText(page, text) {
  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
    view.dispatch({
      changes: { from: pos, insert: txt },
    });
  }, text);

  // Wait for local update
  await page.waitForFunction((txt) => window.__cmView.state.doc.toString().includes(txt), text, {
    timeout: 5000,
  });
}

// Helper to clear editor
async function clearEditor(page) {
  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
  });

  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__ytext.toString().length === 0, {}, { timeout: 5000 });
}

// Helper to get file content from database via API
async function getFileFromDatabase(fileId, token) {
  const response = await fetch(`${backendURL}/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }

  return await response.json();
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

test.describe("Y.js Database Persistence @auth", () => {
  test("should persist Y.js edits to database", async ({ browser, request }) => {
    test.setTimeout(60000);

    const { context, page, token } = await createAuthenticatedPage(browser, request);

    try {
      const fileId = 1;

      // Open file and clear content
      await openFileInEditor(page, fileId);
      await clearEditor(page);

      // Wait for backend to persist the clear (500ms debounce + buffer)
      await page.waitForTimeout(1000);

      // Insert unique test content
      const testContent = `DB Persistence Test - ${Date.now()}\nThis content should persist to database`;
      await insertText(page, testContent);

      // Wait for backend to persist (500ms debounce + buffer)
      await page.waitForTimeout(1000);

      // Verify content is in database
      const fileData = await getFileFromDatabase(fileId, token);

      expect(fileData.source).toContain(testContent);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("should restore content from database on reconnect", async ({ browser, request }) => {
    test.setTimeout(60000);

    // Session 1: Create content
    const session1 = await createAuthenticatedPage(browser, request);
    const fileId = 1;

    try {
      await openFileInEditor(session1.page, fileId);
      await clearEditor(session1.page);
      await session1.page.waitForTimeout(1000);

      const testContent = `Reconnect Test - ${Date.now()}\nContent should persist across sessions`;
      await insertText(session1.page, testContent);

      await session1.page.waitForTimeout(1000);

      // Close first session completely
      await cleanupYjs(session1.page);
      await session1.context.close();

      // Wait a bit to ensure all connections are cleaned up
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Session 2: Reconnect and verify content
      const session2 = await createAuthenticatedPage(browser, request);
      await openFileInEditor(session2.page, fileId);

      const restoredContent = await getEditorContent(session2.page);

      expect(restoredContent).toContain(testContent);

      await cleanupYjs(session2.page);
      await session2.context.close();
    } catch (error) {
      // Cleanup on error
      try {
        await cleanupYjs(session1.page);
        await session1.context.close();
      } catch (_e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  });

  test("should handle multiple rapid edits with debounce", async ({ browser, request }) => {
    test.setTimeout(60000);

    const { context, page, token } = await createAuthenticatedPage(browser, request);

    try {
      const fileId = 1;

      await openFileInEditor(page, fileId);
      await clearEditor(page);
      await page.waitForTimeout(1000);

      // Make multiple rapid edits (within debounce window)
      await insertText(page, "Line 1\n");
      await insertText(page, "Line 2\n");
      await insertText(page, "Line 3\n");

      // All edits should be batched by debounce (500ms)
      await page.waitForTimeout(1000);

      // Verify all content is in database
      const fileData = await getFileFromDatabase(fileId, token);

      expect(fileData.source).toContain("Line 1");
      expect(fileData.source).toContain("Line 2");
      expect(fileData.source).toContain("Line 3");
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("should load initial content from database on first connect", async ({
    browser,
    request,
  }) => {
    test.setTimeout(60000);

    const { context, page, token } = await createAuthenticatedPage(browser, request);

    try {
      const fileId = 1;

      // Get current database content
      const initialFileData = await getFileFromDatabase(fileId, token);
      const dbContent = initialFileData.source || "";

      // Open file in editor (should load from DB)
      await openFileInEditor(page, fileId);

      // Get editor content
      const editorContent = await getEditorContent(page);

      // Editor should match database
      expect(editorContent).toBe(dbContent);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("should persist content after all clients disconnect", async ({ browser, request }) => {
    test.setTimeout(60000);

    const fileId = 1;
    const testContent = `Disconnect Test - ${Date.now()}\nContent should survive all disconnects`;

    // Create session, edit, and fully disconnect
    const { context, page, token } = await createAuthenticatedPage(browser, request);

    try {
      await openFileInEditor(page, fileId);
      await clearEditor(page);
      await page.waitForTimeout(1000);

      await insertText(page, testContent);

      await page.waitForTimeout(1000);

      // Close everything
      await cleanupYjs(page);
      await context.close();

      // Wait to ensure backend processes the disconnect
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check database directly (no Y.js connection)
      const response = await fetch(`${backendURL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.ok).toBeTruthy();
      const fileData = await response.json();

      expect(fileData.source).toContain(testContent);
    } catch (error) {
      try {
        await cleanupYjs(page);
        await context.close();
      } catch (_e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  });
});
