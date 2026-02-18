/**
 * E2E tests for Y.js DATABASE PERSISTENCE
 *
 * Tests that Y.js edits are persisted to PostgreSQL files.source and restored on reconnect.
 * Verifies backend-as-client architecture saves changes to database.
 *
 * Tag: @collab
 *
 * Scope: DB persistence for Y.js collaboration
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  clearEditor,
  insertText,
  getEditorContent,
  cleanupYjs,
} from "./yjs-helpers.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();

async function getFileFromDatabase(fileId, token) {
  const response = await fetch(`${backendURL}/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  return response.json();
}

// Poll the DB until matcher returns true or timeout is reached.
// Polling (not page.waitForTimeout) because DB persistence is a backend-side event
// with no observable browser signal.
async function waitForDbContent(fileId, token, matcher, { timeout = 8000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const data = await getFileFromDatabase(fileId, token);
    if (matcher(data.source ?? "")) return data;
    await new Promise((r) => setTimeout(r, 300));
  }
  const data = await getFileFromDatabase(fileId, token);
  if (matcher(data.source ?? "")) return data;
  throw new Error(
    `DB content did not satisfy condition within ${timeout}ms. ` +
      `Last value: ${JSON.stringify(data.source)}`
  );
}

test.describe("Y.js Database Persistence @collab", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("should persist Y.js edits to database", async ({ browser, request }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);
      await clearEditor(page);

      const testContent = `DB Persistence Test - ${Date.now()}\nThis content should persist to database`;
      await insertText(page, testContent);

      const fileData = await waitForDbContent(fileId, auth.token, (src) =>
        src.includes(testContent)
      );
      expect(fileData.source).toContain(testContent);
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("should restore content from database on reconnect", async ({ browser, request }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const session1 = await createAuthenticatedContext(browser, auth);
    let session2 = null;

    try {
      await openFileInEditor(session1.page, fileId);
      await clearEditor(session1.page);

      const testContent = `Reconnect Test - ${Date.now()}\nContent should persist across sessions`;
      await insertText(session1.page, testContent);

      // Wait until backend has flushed to DB before closing the session
      await waitForDbContent(fileId, auth.token, (src) => src.includes(testContent));

      await cleanupYjs(session1.page);
      await session1.context.close();

      // Allow WS connections to tear down before opening a new session
      await new Promise((r) => setTimeout(r, 1000));

      session2 = await createAuthenticatedContext(browser, auth);
      await openFileInEditor(session2.page, fileId);
      expect(await getEditorContent(session2.page)).toContain(testContent);

      await cleanupYjs(session2.page);
      await session2.context.close();
      session2 = null;
    } catch (error) {
      try {
        await cleanupYjs(session1.page);
        await session1.context.close();
      } catch (_e) {
        /* best-effort cleanup */
      }
      if (session2) {
        try {
          await cleanupYjs(session2.page);
          await session2.context.close();
        } catch (_e) {
          /* best-effort cleanup */
        }
      }
      throw error;
    } finally {
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("should handle multiple rapid edits with debounce", async ({ browser, request }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);
      await clearEditor(page);

      // Make multiple rapid edits (within debounce window)
      await insertText(page, "Line 1\n");
      await insertText(page, "Line 2\n");
      await insertText(page, "Line 3\n");

      const fileData = await waitForDbContent(
        fileId,
        auth.token,
        (src) => src.includes("Line 1") && src.includes("Line 2") && src.includes("Line 3")
      );
      expect(fileData.source).toContain("Line 1");
      expect(fileData.source).toContain("Line 2");
      expect(fileData.source).toContain("Line 3");
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("should load initial content from database on first connect", async ({
    browser,
    request,
  }) => {
    test.setTimeout(60000);
    const initialSource = `Initial Content - ${Date.now()}\nThis was seeded from the database.`;
    const fileId = await createTestFile(request, auth.token, auth.userData.id, initialSource);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);
      const editorContent = await getEditorContent(page);
      expect(editorContent).toBe(initialSource);
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("should persist content after all clients disconnect", async ({ browser, request }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const testContent = `Disconnect Test - ${Date.now()}\nContent should survive all disconnects`;
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);
      await clearEditor(page);
      await insertText(page, testContent);

      await cleanupYjs(page);
      await context.close();

      // Poll DB until backend has written its final save after disconnect
      const fileData = await waitForDbContent(
        fileId,
        auth.token,
        (src) => src.includes(testContent),
        { timeout: 10000 }
      );
      expect(fileData.source).toContain(testContent);
    } catch (error) {
      try {
        await cleanupYjs(page);
        await context.close();
      } catch (_e) {
        /* best-effort cleanup */
      }
      throw error;
    } finally {
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
