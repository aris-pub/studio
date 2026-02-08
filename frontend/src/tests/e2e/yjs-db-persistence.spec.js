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

import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve("../../../.env") });
const BACKEND_PORT = process.env.BACKEND_PORT;
const FRONTEND_PORT = process.env.FRONTEND_PORT;

if (!BACKEND_PORT || !FRONTEND_PORT) {
  throw new Error("BACKEND_PORT and FRONTEND_PORT must be set in .env");
}

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env");
}

// Helper to create authenticated session
async function createAuthenticatedPage(browser, request) {
  const loginResponse = await request.post(`http://localhost:${BACKEND_PORT}/login`, {
    data: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`);
  }

  const loginData = await loginResponse.json();

  const userResponse = await request.get(`http://localhost:${BACKEND_PORT}/me`, {
    headers: { Authorization: `Bearer ${loginData.access_token}` },
  });

  if (!userResponse.ok()) {
    throw new Error(`Failed to fetch user data: ${userResponse.status()}`);
  }

  const userData = await userResponse.json();

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`http://localhost:${FRONTEND_PORT}`, { waitUntil: "domcontentloaded" });
  await page.evaluate((data) => {
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }, { ...loginData, user: userData });

  return { context, page, token: loginData.access_token };
}

// Helper to open file and editor
async function openFileInEditor(page, fileId) {
  console.log(`[TEST] Opening file ${fileId} in editor`);
  await page.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });

  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

  // Wait for Y.js provider to be synced
  await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });
  console.log(`[TEST] File ${fileId} editor opened and synced`);
}

// Helper to get editor content
async function getEditorContent(page) {
  return await page.evaluate("window.__cmView.state.doc.toString()");
}

// Helper to insert text programmatically
async function insertText(page, text) {
  console.log(`[TEST] Inserting text: "${text}"`);
  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
    view.dispatch({
      changes: { from: pos, insert: txt },
    });
  }, text);

  // Wait for local update
  await page.waitForFunction(
    (txt) => window.__cmView.state.doc.toString().includes(txt),
    text,
    { timeout: 5000 }
  );
  console.log(`[TEST] Text inserted successfully`);
}

// Helper to clear editor
async function clearEditor(page) {
  console.log("[TEST] Clearing editor");
  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
  });

  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__ytext.toString().length === 0, {}, { timeout: 5000 });
  console.log("[TEST] Editor cleared");
}

// Helper to get file content from database via API
async function getFileFromDatabase(fileId, token) {
  const response = await fetch(`http://localhost:${BACKEND_PORT}/files/${fileId}`, {
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
            ws.addEventListener('close', () => resolve(), { once: true });
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
  } catch (error) {
    console.log("[TEST] Y.js cleanup error (expected if page closed):", error.message);
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
      console.log("[TEST] Waiting for backend to persist changes to database...");
      await page.waitForTimeout(1000);

      // Verify content is in database
      console.log("[TEST] Fetching file from database via API...");
      const fileData = await getFileFromDatabase(fileId, token);

      console.log(`[TEST] Database content length: ${fileData.source?.length || 0} chars`);
      console.log(`[TEST] Database content: "${fileData.source?.substring(0, 100) || 'EMPTY'}..."`);

      expect(fileData.source).toContain(testContent);
      console.log("[TEST] ✅ Content persisted to database");
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

      console.log("[TEST] Waiting for backend to persist...");
      await session1.page.waitForTimeout(1000);

      // Close first session completely
      await cleanupYjs(session1.page);
      await session1.context.close();
      console.log("[TEST] First session closed");

      // Wait a bit to ensure all connections are cleaned up
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Session 2: Reconnect and verify content
      const session2 = await createAuthenticatedPage(browser, request);
      await openFileInEditor(session2.page, fileId);

      const restoredContent = await getEditorContent(session2.page);
      console.log(`[TEST] Restored content: "${restoredContent.substring(0, 100)}..."`);

      expect(restoredContent).toContain(testContent);
      console.log("[TEST] ✅ Content restored from database on reconnect");

      await cleanupYjs(session2.page);
      await session2.context.close();
    } catch (error) {
      // Cleanup on error
      try {
        await cleanupYjs(session1.page);
        await session1.context.close();
      } catch (e) {
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
      console.log("[TEST] Making rapid edits...");
      await insertText(page, "Line 1\n");
      await insertText(page, "Line 2\n");
      await insertText(page, "Line 3\n");

      // All edits should be batched by debounce (500ms)
      console.log("[TEST] Waiting for debounce to complete...");
      await page.waitForTimeout(1000);

      // Verify all content is in database
      const fileData = await getFileFromDatabase(fileId, token);

      expect(fileData.source).toContain("Line 1");
      expect(fileData.source).toContain("Line 2");
      expect(fileData.source).toContain("Line 3");
      console.log("[TEST] ✅ Multiple rapid edits persisted correctly");
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("should load initial content from database on first connect", async ({ browser, request }) => {
    test.setTimeout(60000);

    const { context, page, token } = await createAuthenticatedPage(browser, request);

    try {
      const fileId = 1;

      // Get current database content
      const initialFileData = await getFileFromDatabase(fileId, token);
      const dbContent = initialFileData.source || "";
      console.log(`[TEST] Database has ${dbContent.length} chars of content`);

      // Open file in editor (should load from DB)
      await openFileInEditor(page, fileId);

      // Get editor content
      const editorContent = await getEditorContent(page);
      console.log(`[TEST] Editor has ${editorContent.length} chars of content`);

      // Editor should match database
      expect(editorContent).toBe(dbContent);
      console.log("[TEST] ✅ Initial content loaded from database");
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

      console.log("[TEST] Waiting for persistence...");
      await page.waitForTimeout(1000);

      // Close everything
      await cleanupYjs(page);
      await context.close();
      console.log("[TEST] All clients disconnected");

      // Wait to ensure backend processes the disconnect
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check database directly (no Y.js connection)
      const response = await fetch(`http://localhost:${BACKEND_PORT}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.ok).toBeTruthy();
      const fileData = await response.json();

      expect(fileData.source).toContain(testContent);
      console.log("[TEST] ✅ Content persisted after all clients disconnected");
    } catch (error) {
      try {
        await cleanupYjs(page);
        await context.close();
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  });
});
