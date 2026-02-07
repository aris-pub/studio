/**
 * E2E tests for Y.js - SINGLE USER, SINGLE TAB
 *
 * Tests basic Y.js functionality with one user in one browser tab.
 * Verifies Y.Doc initialization, WebSocket connection, and content persistence.
 *
 * Tag: @collab
 *
 * Scope: studio-can (Y.js: Single user, single tab editing)
 */

import { test, expect } from "@playwright/test";

// These are loaded by playwright.config.js via dotenv
const BACKEND_PORT = process.env.BACKEND_PORT;
const FRONTEND_PORT = process.env.FRONTEND_PORT;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!BACKEND_PORT || !FRONTEND_PORT) {
  throw new Error("BACKEND_PORT and FRONTEND_PORT must be set in .env");
}

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

  // Forward ALL browser console messages to test output
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });

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

  await page.waitForTimeout(1000);

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

// Helper to type in editor with CI-specific timing adjustments
async function typeInEditor(page, text) {
  await page.click(".cm-content");
  await page.waitForTimeout(200);

  // Fix #1: Increase keyboard delay in CI to prevent race conditions
  const delay = process.env.CI ? 200 : 50;
  await page.keyboard.type(text, { delay });

  // Fix #3: Wait for content to stabilize (duplication happens 400ms after initial sync)
  // Just wait longer in CI for the race condition to fully resolve
  await page.waitForTimeout(process.env.CI ? 500 : 100);
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

  // CRITICAL: Wait for Y.text to sync (not just editor)
  console.log("[TEST clearEditor] ⏳ Waiting for Y.text to sync...");
  await page.waitForFunction(
    () => window.__ytext.toString().length === 0 && window.__cmView.state.doc.length === 0,
    {},
    { timeout: 5000 }
  );

  const afterClear = await page.evaluate(() => ({
    editorLength: window.__cmView.state.doc.length,
    ytextLength: window.__ytext.toString().length,
    providerSynced: window.__provider.synced
  }));
  console.log(`[TEST clearEditor] 📊 After clear - Editor: ${afterClear.editorLength} chars, Y.text: ${afterClear.ytextLength} chars, synced: ${afterClear.providerSynced}`);

  await page.waitForTimeout(100);
  console.log("[TEST clearEditor] ✅ Clear complete");
}

// Helper to cleanup Y.js state
async function cleanupYjs(page) {
  try {
    await page.evaluate(() => {
      if (window.__provider) {
        window.__provider.disconnect();
        window.__provider.destroy();
        delete window.__provider;
      }

      if (window.__ydoc) {
        window.__ydoc.destroy();
        delete window.__ydoc;
      }

      delete window.__ytext;
      delete window.__awareness;
      delete window.__cmView;
    });
  } catch (error) {
    console.log("[Test] Y.js cleanup error (expected if page closed):", error.message);
  }
}

test.describe("Y.js Single User, Single Tab @collab", () => {
  test.describe("Basic Editing - No Duplication", () => {
    test("should not duplicate keystrokes when typing", async ({ browser, request }) => {
      const { context, page } = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        // Type HELLO character by character
        const testString = "HELLO";
        for (let i = 0; i < testString.length; i++) {
          await typeInEditor(page, testString[i]);
          const content = await getEditorContent(page);

          // Check no duplication after each character
          const expectedLength = i + 1;
          const expectedContent = testString.substring(0, i + 1);
          expect(content).toBe(expectedContent);
          expect(content.length).toBe(expectedLength);
        }

        const finalContent = await getEditorContent(page);
        expect(finalContent).toBe("HELLO");
        expect(finalContent.length).toBe(5);
      } finally {
        await cleanupYjs(page);
        await context.close();
      }
    });

    test("should handle rapid typing without duplication", async ({ browser, request }) => {
      const { context, page } = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        // Rapid insert
        await insertText(page, "The quick brown fox jumps over the lazy dog");

        const content = await getEditorContent(page);
        expect(content).toBe("The quick brown fox jumps over the lazy dog");
        expect(content.length).toBe(43);
      } finally {
        await cleanupYjs(page);
        await context.close();
      }
    });

    test("should handle delete operations correctly", async ({ browser, request }) => {
      const { context, page } = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        await insertText(page, "Hello World");
        await page.waitForTimeout(200);

        // Delete 'World'
        await page.evaluate(() => {
          const view = window.__cmView;
          view.dispatch({
            changes: { from: 6, to: 11, insert: "" },
          });
        });
        await page.waitForTimeout(200);

        const content = await getEditorContent(page);
        expect(content).toBe("Hello ");
      } finally {
        await cleanupYjs(page);
        await context.close();
      }
    });
  });

  test.describe("Performance", () => {
    test("should handle large document without lag", async ({ browser, request }) => {
      const { context, page } = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        // Insert large text
        const largeText = "Line of text\n".repeat(100);
        const startTime = Date.now();

        await insertText(page, largeText);
        await page.waitForTimeout(500);

        const endTime = Date.now();
        const duration = endTime - startTime;

        const content = await getEditorContent(page);
        expect(content.split("\n").length).toBe(101); // 100 lines + empty line
        expect(duration).toBeLessThan(2000); // Should be fast
      } finally {
        await cleanupYjs(page);
        await context.close();
      }
    });
  });
});
