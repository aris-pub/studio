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

import { test, expect } from "./fixtures.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();
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

  // Forward ALL browser console messages to test output
  page.on("console", (_msg) => {
    // Capture console messages for debugging
  });

  await page.goto(`/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (data) => {
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    },
    { ...loginData, user: userData }
  );

  return { context, page };
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

  await page.waitForTimeout(1000);
}

// Helper to get editor content
async function getEditorContent(page) {
  return await page.evaluate("window.__cmView.state.doc.toString()");
}

// Helper to get Y.text content
async function getYTextContent(page) {
  return await page.evaluate("window.__ytext.toString()");
}

// Helper to type in editor
async function typeInEditor(page, text) {
  await page.click(".cm-content");
  await page.waitForTimeout(100);
  await page.keyboard.type(text, { delay: 50 });
  await page.waitForTimeout(50);
}

// Helper to insert text programmatically
async function insertText(page, text) {
  const startLength = await page.evaluate(() => window.__cmView.state.doc.length);

  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
    view.dispatch({
      changes: { from: pos, insert: txt },
    });
  }, text);

  await page.waitForFunction(
    ({ expectedLength }) => window.__cmView.state.doc.length === expectedLength,
    { expectedLength: startLength + text.length },
    { timeout: 5000 }
  );

  await page.waitForTimeout(100);
}

// Helper to clear editor
async function clearEditor(page) {
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
  });

  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });

  // CRITICAL: Wait for Y.text to sync (not just editor)
  await page.waitForFunction(
    () => window.__ytext.toString().length === 0 && window.__cmView.state.doc.length === 0,
    {},
    { timeout: 5000 }
  );

  await page.waitForTimeout(100);
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
  } catch (_error) {
    // Ignore cleanup errors
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
          const ytextContent = await getYTextContent(page);

          // Check no duplication after each character
          const expectedLength = i + 1;
          const expectedContent = testString.substring(0, i + 1);
          expect(content).toBe(expectedContent);
          expect(content.length).toBe(expectedLength);

          // CRITICAL: Verify Y.text syncs with CodeMirror
          expect(ytextContent).toBe(expectedContent);
          expect(ytextContent.length).toBe(expectedLength);
        }

        const finalContent = await getEditorContent(page);
        const finalYTextContent = await getYTextContent(page);
        expect(finalContent).toBe("HELLO");
        expect(finalContent.length).toBe(5);

        // CRITICAL: Verify Y.text syncs with CodeMirror
        expect(finalYTextContent).toBe("HELLO");
        expect(finalYTextContent.length).toBe(5);
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
        const ytextContent = await getYTextContent(page);
        expect(content).toBe("The quick brown fox jumps over the lazy dog");
        expect(content.length).toBe(43);

        // CRITICAL: Verify Y.text syncs with CodeMirror
        expect(ytextContent).toBe("The quick brown fox jumps over the lazy dog");
        expect(ytextContent.length).toBe(43);
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
        const ytextContent = await getYTextContent(page);
        expect(content).toBe("Hello ");

        // CRITICAL: Verify Y.text syncs with CodeMirror
        expect(ytextContent).toBe("Hello ");
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
        const ytextContent = await getYTextContent(page);
        expect(content.split("\n").length).toBe(101); // 100 lines + empty line
        expect(duration).toBeLessThan(2000); // Should be fast

        // CRITICAL: Verify Y.text syncs with CodeMirror
        expect(ytextContent).toBe(content);
        expect(ytextContent.split("\n").length).toBe(101);
      } finally {
        await cleanupYjs(page);
        await context.close();
      }
    });
  });
});
