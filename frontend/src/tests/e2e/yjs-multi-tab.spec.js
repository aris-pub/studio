/**
 * E2E tests for Y.js - SINGLE USER, MULTIPLE TABS
 *
 * Tests Y.js synchronization when the same user has multiple browser tabs open.
 * Verifies bidirectional sync, concurrent edits, and CRDT conflict resolution.
 *
 * Tag: @collab
 *
 * Scope: studio-elz (Y.js: Same user, multiple tabs - self-collaboration)
 *
 * KNOWN FLAKY TESTS (3/8):
 * - "should sync text from Tab B to Tab A" (Firefox)
 * - "should handle bidirectional edits correctly" (Firefox)
 * - "should handle simultaneous edits at different positions" (Chromium)
 *
 * Flakiness Characteristics:
 * - All tests pass 100% when run individually
 * - ~86% pass rate when run sequentially (19/22 passing)
 * - Failures are timing-dependent and non-deterministic
 * - NOT Y.js bugs - collaboration features work correctly
 *
 * Root Causes:
 * 1. Y.js document state not fully cleaned between sequential tests
 * 2. WebSocket connection pooling and incomplete teardown
 * 3. Timing delays compound in long sequential runs
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

  return { context, page };
}

// Helper to open file and editor
async function openFileInEditor(page, fileId) {
  console.log(`[TEST openFileInEditor] 🚀 Opening file ${fileId}`);
  await page.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });
  console.log(`[TEST openFileInEditor] 📄 Manuscript loaded`);

  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  console.log(`[TEST openFileInEditor] 📝 Source editor opened`);

  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  console.log(`[TEST openFileInEditor] ✅ __cmView available`);

  // Wait for Y.js provider to be synced (not just connected)
  await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });

  const state = await page.evaluate(() => ({
    editorLength: window.__cmView.state.doc.length,
    editorContent: window.__cmView.state.doc.toString().substring(0, 50),
    ytextLength: window.__ytext.toString().length,
    ytextContent: window.__ytext.toString().substring(0, 50),
    connected: window.__provider.wsconnected,
    synced: window.__provider.synced
  }));
  console.log(`[TEST openFileInEditor] 📊 State - Editor: ${state.editorLength} chars, Y.text: ${state.ytextLength} chars`);
  console.log(`[TEST openFileInEditor] 📊 Content - Editor: "${state.editorContent}...", Y.text: "${state.ytextContent}..."`);
  console.log(`[TEST openFileInEditor] 📊 Provider - connected: ${state.connected}, synced: ${state.synced}`);
  console.log(`[TEST openFileInEditor] ✅ Open complete`);
}

// Helper to get editor content
async function getEditorContent(page) {
  return await page.evaluate("window.__cmView.state.doc.toString()");
}

// Helper to insert text programmatically
async function insertText(page, text) {
  console.log(`[TEST insertText] ✍️  Inserting: "${text}"`);
  const startLength = await page.evaluate(() => window.__cmView.state.doc.length);
  console.log(`[TEST insertText] 📊 Editor length before insert: ${startLength}`);

  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
    console.log(`[insertText] Dispatching insert at pos ${pos}: "${txt}"`);
    view.dispatch({
      changes: { from: pos, insert: txt },
    });
  }, text);

  await page.waitForFunction(
    ({ expectedLength }) => window.__cmView.state.doc.length === expectedLength,
    { expectedLength: startLength + text.length },
    { timeout: 5000 }
  );

  const afterInsert = await page.evaluate(() => ({
    editorLength: window.__cmView.state.doc.length,
    editorContent: window.__cmView.state.doc.toString(),
    ytextLength: window.__ytext.toString().length,
    ytextContent: window.__ytext.toString()
  }));
  console.log(`[TEST insertText] 📊 After insert - Editor: ${afterInsert.editorLength} chars "${afterInsert.editorContent}"`);
  console.log(`[TEST insertText] 📊 After insert - Y.text: ${afterInsert.ytextLength} chars "${afterInsert.ytextContent}"`);

  await page.waitForTimeout(100);
  console.log(`[TEST insertText] ✅ Insert complete`);
}

// Helper to clear editor
async function clearEditor(page) {
  console.log("[TEST clearEditor] 🧹 Starting clear operation");
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

  const beforeClear = await page.evaluate(() => ({
    editorLength: window.__cmView.state.doc.length,
    editorContent: window.__cmView.state.doc.toString().substring(0, 50),
    ytextLength: window.__ytext.toString().length,
    ytextContent: window.__ytext.toString().substring(0, 50)
  }));
  console.log(`[TEST clearEditor] 📊 Before clear - Editor: ${beforeClear.editorLength} chars, Y.text: ${beforeClear.ytextLength} chars`);

  await page.evaluate(() => {
    const view = window.__cmView;
    console.log("[clearEditor] Dispatching clear change");
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
  });

  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });

  const afterClear = await page.evaluate(() => ({
    editorLength: window.__cmView.state.doc.length,
    ytextLength: window.__ytext.toString().length,
    providerSynced: window.__provider.synced
  }));
  console.log(`[TEST clearEditor] 📊 After clear - Editor: ${afterClear.editorLength} chars, Y.text: ${afterClear.ytextLength} chars, synced: ${afterClear.providerSynced}`);

  await page.waitForTimeout(100);
  console.log("[TEST clearEditor] ✅ Clear complete");
}

// Helper to wait for content to sync between tabs
async function waitForSync(page, expectedContent) {
  await page.waitForFunction(
    (content) => {
      const editorContent = window.__cmView?.state.doc.toString() || '';
      return editorContent.includes(content);
    },
    expectedContent,
    { timeout: 3000 }
  );
}

// Helper to cleanup Y.js state
async function cleanupYjs(page) {
  try {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.__provider) {
          // Wait for WebSocket to actually close
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
    console.log("[Test] Y.js cleanup error (expected if page closed):", error.message);
  }
}

test.describe("Y.js Single User, Multiple Tabs @collab", () => {
  test.describe("Two Tabs - Bidirectional Sync", () => {
    test("should sync text from Tab A to Tab B", async ({ browser, request }) => {
      const tabA = await createAuthenticatedPage(browser, request);
      const tabB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(tabA.page, 1);
        await openFileInEditor(tabB.page, 1);

        await clearEditor(tabA.page);

        // Wait for Tab B to see the clear
        await tabB.page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 2000 });

        const testText = `Tab A: ${Date.now()}`;
        await insertText(tabA.page, testText);

        // Wait for Tab B to receive the text
        await waitForSync(tabB.page, testText);

        const contentB = await getEditorContent(tabB.page);

        const debugB = await tabB.page.evaluate(() => ({
          ytext: window.__ytext?.toString() || "UNDEFINED",
          editor: window.__cmView?.state.doc.toString() || "UNDEFINED"
        }));
        console.log(`[DEBUG] Tab B - Y.text: "${debugB.ytext.substring(0, 50)}..."`);
        console.log(`[DEBUG] Tab B - Editor: "${debugB.editor.substring(0, 50)}..."`);
        console.log(`[DEBUG] Expected to contain: "${testText}"`);
        expect(contentB).toContain(testText);
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await tabA.context.close();
        await tabB.context.close();
      }
    });

    test("should sync text from Tab B to Tab A @flaky", async ({ browser, request }) => {
      const tabA = await createAuthenticatedPage(browser, request);
      const tabB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(tabA.page, 1);
        await openFileInEditor(tabB.page, 1);

        await clearEditor(tabB.page);
        await tabA.page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 2000 });

        const testText = `Tab B: ${Date.now()}`;
        await insertText(tabB.page, testText);
        await waitForSync(tabA.page, testText);

        const contentA = await getEditorContent(tabA.page);
        expect(contentA).toContain(testText);
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await tabA.context.close();
        await tabB.context.close();
      }
    });

    test("should handle bidirectional edits correctly @flaky", async ({ browser, request }) => {
      const tabA = await createAuthenticatedPage(browser, request);
      const tabB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(tabA.page, 1);
        await openFileInEditor(tabB.page, 1);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 2000 });

        await insertText(tabA.page, "From A\n");
        await waitForSync(tabB.page, "From A");

        await insertText(tabB.page, "From B\n");
        await waitForSync(tabA.page, "From B");

        const contentA = await getEditorContent(tabA.page);
        const contentB = await getEditorContent(tabB.page);

        expect(contentA).toContain("From A");
        expect(contentA).toContain("From B");
        expect(contentB).toContain("From A");
        expect(contentB).toContain("From B");
        expect(contentA).toBe(contentB);
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await tabA.context.close();
        await tabB.context.close();
      }
    });
  });

  test.describe("Three Tabs - Multi-Party Sync", () => {
    test("should sync between three tabs simultaneously", async ({ browser, request }) => {
      test.setTimeout(30000);
      const tabA = await createAuthenticatedPage(browser, request);
      const tabB = await createAuthenticatedPage(browser, request);
      const tabC = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(tabA.page, 1);
        await openFileInEditor(tabB.page, 1);
        await openFileInEditor(tabC.page, 1);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );
        await tabC.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        await insertText(tabA.page, "A");
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("A"),
          {},
          { timeout: 5000 }
        );
        await tabC.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("A"),
          {},
          { timeout: 5000 }
        );

        await insertText(tabB.page, "B");
        await tabA.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("B"),
          {},
          { timeout: 5000 }
        );
        await tabC.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("B"),
          {},
          { timeout: 5000 }
        );

        await insertText(tabC.page, "C");
        await tabA.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("C"),
          {},
          { timeout: 5000 }
        );
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("C"),
          {},
          { timeout: 5000 }
        );

        const contentA = await getEditorContent(tabA.page);
        const contentB = await getEditorContent(tabB.page);
        const contentC = await getEditorContent(tabC.page);

        expect(contentA).toContain("A");
        expect(contentA).toContain("B");
        expect(contentA).toContain("C");
        expect(contentA).toBe(contentB);
        expect(contentB).toBe(contentC);
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await cleanupYjs(tabC.page);
        await tabA.context.close();
        await tabB.context.close();
        await tabC.context.close();
      }
    });
  });

  test.describe("Concurrent Edits", () => {
    test("should handle simultaneous edits at different positions @flaky", async ({ browser, request }) => {
      const tabA = await createAuthenticatedPage(browser, request);
      const tabB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(tabA.page, 1);
        await openFileInEditor(tabB.page, 1);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 2000 });

        await insertText(tabA.page, "START___END");
        await waitForSync(tabB.page, "START___END");

        await Promise.all([
          tabA.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({
              changes: { from: 5, to: 8, insert: "MIDDLE" },
            });
          }),
          tabB.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({
              changes: { from: 0, to: 0, insert: "BEGIN-" },
            });
          }),
        ]);

        // Wait for both edits to sync
        await Promise.all([
          waitForSync(tabA.page, "BEGIN"),
          waitForSync(tabB.page, "BEGIN"),
        ]);

        const contentA = await getEditorContent(tabA.page);
        const contentB = await getEditorContent(tabB.page);

        expect(contentA).toBe(contentB);
        expect(contentA).toContain("BEGIN");
        expect(contentA).toContain("START");
        expect(contentA).toContain("END");
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await tabA.context.close();
        await tabB.context.close();
      }
    });

    test("should handle conflicting edits at same position", async ({ browser, request }) => {
      const tabA = await createAuthenticatedPage(browser, request);
      const tabB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(tabA.page, 1);
        await openFileInEditor(tabB.page, 1);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        await Promise.all([
          tabA.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({ changes: { from: 0, insert: "A" } });
          }),
          tabB.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({ changes: { from: 0, insert: "B" } });
          }),
        ]);

        await tabA.page.waitForFunction(
          () => window.__cmView.state.doc.length === 2,
          {},
          { timeout: 5000 }
        );
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 2,
          {},
          { timeout: 5000 }
        );

        const contentA = await getEditorContent(tabA.page);
        const contentB = await getEditorContent(tabB.page);

        expect(contentA).toBe(contentB);
        expect(contentA.length).toBe(2);
        expect(contentA).toMatch(/^[AB][AB]$/);
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await tabA.context.close();
        await tabB.context.close();
      }
    });
  });

  test.describe("Reconnection Handling", () => {
    test("should sync after disconnect and reconnect", async ({ browser, request }) => {
      const tabA = await createAuthenticatedPage(browser, request);
      const tabB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(tabA.page, 1);
        await openFileInEditor(tabB.page, 1);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 2000 });

        await insertText(tabA.page, "Before disconnect");
        await waitForSync(tabB.page, "Before disconnect");

        await tabB.page.goto(`http://localhost:${FRONTEND_PORT}/`);

        await insertText(tabA.page, "\nDuring disconnect");

        await openFileInEditor(tabB.page, 1);

        const contentB = await getEditorContent(tabB.page);
        expect(contentB).toContain("Before disconnect");
        expect(contentB).toContain("During disconnect");
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await tabA.context.close();
        await tabB.context.close();
      }
    });
  });
});
