/**
 * E2E tests for Y.js real-time collaboration
 *
 * Tests multi-user scenarios with real WebSocket connections
 * Tag: @collab
 *
 * KNOWN FLAKY TESTS (3/22):
 * - "should sync text from User B to User A" (Firefox)
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
 *
 * ALTERNATIVES TO FIX FLAKINESS (not currently implemented):
 *
 * 1. **Proper Y.js Teardown** (recommended, moderate effort)
 *    - Explicitly call ydoc.destroy() in afterEach hooks
 *    - Close WebSocket connections explicitly before test ends
 *    - Add beforeEach hook to verify clean state
 *    Pros: Fixes root cause, no architectural changes
 *    Cons: Requires exposing Y.js internals for cleanup
 *
 * 2. **Separate Test Files** (easy, high parallelization)
 *    - Split tests into separate files (single-user.spec.js, two-user.spec.js, etc.)
 *    - Run in different worker processes
 *    Pros: Natural isolation, good for CI parallelization
 *    Cons: Loses logical grouping
 *
 * 3. **Mock WebSocket Layer** (high effort, deterministic)
 *    - Replace y-websocket with in-memory Y.js provider
 *    - Use test doubles for collaboration sync
 *    Pros: Fully deterministic, no real network delays
 *    Cons: Doesn't test real WebSocket integration
 *
 * 4. **Database Cleanup Between Tests** (moderate effort)
 *    - Reset file content in database before each test
 *    - Ensure Y.js server state is cleared
 *    Pros: Clean slate for each test
 *    Cons: Requires database access, slower tests
 *
 * 5. **Unique File IDs Per Test** (attempted, had issues)
 *    - Create new file for each test via API
 *    - Ensures isolated Y.js documents
 *    Pros: Complete document isolation
 *    Cons: API call overhead, file creation can fail, doesn't fix WebSocket pooling
 *
 * 6. **Force Sequential with Delays** (not recommended)
 *    - Use test.serial() + artificial delays between tests
 *    Pros: Simple to implement
 *    Cons: Masks problem, makes tests slower, unreliable
 *
 * 7. **Restart Y.js Server Between Tests** (nuclear option)
 *    - Stop/start WebSocket server for each test
 *    Pros: Guaranteed clean state
 *    Cons: Very slow, complex setup, overkill
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

// Test user credentials from environment
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env");
}

// Helper to create authenticated session
async function createAuthenticatedPage(browser, request) {
  // Login to get fresh tokens
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

  // Fetch user data
  const userResponse = await request.get(`http://localhost:${BACKEND_PORT}/me`, {
    headers: { Authorization: `Bearer ${loginData.access_token}` },
  });

  if (!userResponse.ok()) {
    throw new Error(`Failed to fetch user data: ${userResponse.status()}`);
  }

  const userData = await userResponse.json();

  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate and inject fresh tokens and user data
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

  // Wait for __cmView to be available
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  console.log(`[TEST openFileInEditor] ✅ __cmView available`);

  // Wait for Y.js initial sync
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

// Helper to type in editor
async function typeInEditor(page, text) {
  await page.click(".cm-content");
  await page.waitForTimeout(200);
  await page.keyboard.press(text);
  await page.waitForTimeout(100);
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

  // Wait for text to actually appear in the editor
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

  // Extra buffer for Y.js propagation
  await page.waitForTimeout(100);
  console.log(`[TEST insertText] ✅ Insert complete`);
}

// Helper to clear editor
async function clearEditor(page) {
  console.log("[TEST clearEditor] 🧹 Starting clear operation");
  // Ensure __cmView is available
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

  const beforeClear = await page.evaluate(() => ({
    editorLength: window.__cmView.state.doc.length,
    editorContent: window.__cmView.state.doc.toString().substring(0, 50),
    ytextLength: window.__ytext.toString().length,
    ytextContent: window.__ytext.toString().substring(0, 50)
  }));
  console.log("[TEST clearEditor] 📊 Before clear - Editor: ${beforeClear.editorLength} chars, Y.text: ${beforeClear.ytextLength} chars");

  await page.evaluate(() => {
    const view = window.__cmView;
    console.log("[clearEditor] Dispatching clear change");
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
  });

  // Wait for editor to actually be empty (Y.js sync complete)
  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });

  const afterClear = await page.evaluate(() => ({
    editorLength: window.__cmView.state.doc.length,
    ytextLength: window.__ytext.toString().length,
    providerSynced: window.__provider.synced
  }));
  console.log("[TEST clearEditor] 📊 After clear - Editor: ${afterClear.editorLength} chars, Y.text: ${afterClear.ytextLength} chars, synced: ${afterClear.providerSynced}");

  // Extra buffer for Y.js propagation
  await page.waitForTimeout(100);
  console.log("[TEST clearEditor] ✅ Clear complete");
}

// Helper to cleanup Y.js state (prevents test interference)
async function cleanupYjs(page) {
  try {
    await page.evaluate(() => {
      // Disconnect and destroy provider
      if (window.__provider) {
        window.__provider.disconnect();
        window.__provider.destroy();
        delete window.__provider;
      }

      // Destroy Y.js document
      if (window.__ydoc) {
        window.__ydoc.destroy();
        delete window.__ydoc;
      }

      // Clean up references
      delete window.__ytext;
      delete window.__awareness;
      delete window.__cmView;
    });
  } catch (error) {
    // Page might be closed or navigated away, ignore cleanup errors
    console.log("[Test] Y.js cleanup error (expected if page closed):", error.message);
  }
}

test.describe("Y.js Collaboration @collab", () => {
  test.describe("Single User - No Duplication", () => {
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

  test.describe("Two Users - Bidirectional Sync", () => {
    test("should sync text from User A to User B", async ({ browser, request }) => {
      const userA = await createAuthenticatedPage(browser, request);

      const userB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);

        // DEBUG: Check Y.text state after clear
        const ytextAfterClear = await userA.page.evaluate(() => ({
          ytext: window.__ytext?.toString() || "UNDEFINED",
          ytextLength: window.__ytext?.toString().length || 0,
          editorContent: window.__cmView?.state.doc.toString() || "UNDEFINED"
        }));
        console.log(`[DEBUG] After clear - Y.text: "${ytextAfterClear.ytext.substring(0, 50)}..." (${ytextAfterClear.ytextLength} chars)`);
        console.log(`[DEBUG] After clear - Editor: "${ytextAfterClear.editorContent.substring(0, 50)}..."`);

        await userB.page.waitForTimeout(2000);  // Increased from 500ms to test timing hypothesis

        // User A types
        const testText = `User A: ${Date.now()}`;
        await insertText(userA.page, testText);
        await userB.page.waitForTimeout(1000);

        // User B should see User A's text
        const contentB = await getEditorContent(userB.page);

        // DEBUG: Check what User B actually sees
        const debugB = await userB.page.evaluate(() => ({
          ytext: window.__ytext?.toString() || "UNDEFINED",
          editor: window.__cmView?.state.doc.toString() || "UNDEFINED"
        }));
        console.log(`[DEBUG] User B - Y.text: "${debugB.ytext.substring(0, 50)}..."`);
        console.log(`[DEBUG] User B - Editor: "${debugB.editor.substring(0, 50)}..."`);
        console.log(`[DEBUG] Expected to contain: "${testText}"`);
        expect(contentB).toContain(testText);
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await userA.context.close();
        await userB.context.close();
      }
    });

    test("should sync text from User B to User A @flaky", async ({ browser, request }) => {
      const userA = await createAuthenticatedPage(browser, request);

      const userB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userB.page);
        await userA.page.waitForTimeout(500);

        // User B types
        const testText = `User B: ${Date.now()}`;
        await insertText(userB.page, testText);
        await userA.page.waitForTimeout(1000);

        // User A should see User B's text
        const contentA = await getEditorContent(userA.page);
        expect(contentA).toContain(testText);
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await userA.context.close();
        await userB.context.close();
      }
    });

    test("should handle bidirectional edits correctly @flaky", async ({ browser, request }) => {
      const userA = await createAuthenticatedPage(browser, request);

      const userB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(2000);  // Increased from 500ms to test timing hypothesis

        // User A types
        await insertText(userA.page, "From A\n");
        await userB.page.waitForTimeout(500);

        // User B types
        await insertText(userB.page, "From B\n");
        await userA.page.waitForTimeout(500);

        // Both should have both texts
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);

        expect(contentA).toContain("From A");
        expect(contentA).toContain("From B");
        expect(contentB).toContain("From A");
        expect(contentB).toContain("From B");
        expect(contentA).toBe(contentB);
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await userA.context.close();
        await userB.context.close();
      }
    });
  });

  test.describe("Three Users - Multi-Party Sync", () => {
    test("should sync between three users simultaneously", async ({ browser, request }) => {
      test.setTimeout(30000); // 30s timeout for complex 3-user scenario
      const userA = await createAuthenticatedPage(browser, request);

      const userB = await createAuthenticatedPage(browser, request);
      const userC = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);
        await openFileInEditor(userC.page, 1);

        await clearEditor(userA.page);
        // Wait for clear to sync to all users
        await userB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );
        await userC.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        // Each user types
        await insertText(userA.page, "A");
        // Wait for 'A' to sync to all users
        await userB.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("A"),
          {},
          { timeout: 5000 }
        );
        await userC.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("A"),
          {},
          { timeout: 5000 }
        );

        await insertText(userB.page, "B");
        // Wait for 'B' to sync to all users
        await userA.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("B"),
          {},
          { timeout: 5000 }
        );
        await userC.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("B"),
          {},
          { timeout: 5000 }
        );

        await insertText(userC.page, "C");
        // Wait for 'C' to sync to all users
        await userA.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("C"),
          {},
          { timeout: 5000 }
        );
        await userB.page.waitForFunction(
          () => window.__cmView.state.doc.toString().includes("C"),
          {},
          { timeout: 5000 }
        );

        // All should have ABC
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);
        const contentC = await getEditorContent(userC.page);

        expect(contentA).toContain("A");
        expect(contentA).toContain("B");
        expect(contentA).toContain("C");
        expect(contentA).toBe(contentB);
        expect(contentB).toBe(contentC);
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await cleanupYjs(userC.page);
        await userA.context.close();
        await userB.context.close();
        await userC.context.close();
      }
    });
  });

  test.describe("Concurrent Edits", () => {
    test("should handle simultaneous edits at different positions @flaky", async ({ browser, request }) => {
      const userA = await createAuthenticatedPage(browser, request);

      const userB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(2000);  // Increased from 500ms to test timing hypothesis

        // Set initial content
        await insertText(userA.page, "START___END");
        await userB.page.waitForTimeout(500);

        // Both users edit simultaneously at different positions
        await Promise.all([
          userA.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({
              changes: { from: 5, to: 8, insert: "MIDDLE" },
            });
          }),
          userB.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({
              changes: { from: 0, to: 0, insert: "BEGIN-" },
            });
          }),
        ]);

        await userA.page.waitForTimeout(1000);
        await userB.page.waitForTimeout(1000);

        // Both should have converged (order might vary due to OT)
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);

        expect(contentA).toBe(contentB);
        expect(contentA).toContain("BEGIN");
        expect(contentA).toContain("START");
        expect(contentA).toContain("END");
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await userA.context.close();
        await userB.context.close();
      }
    });

    test("should handle conflicting edits at same position", async ({ browser, request }) => {
      const userA = await createAuthenticatedPage(browser, request);

      const userB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        // Both users insert at position 0 simultaneously (no length verification - concurrent operation)
        await Promise.all([
          userA.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({ changes: { from: 0, insert: "A" } });
          }),
          userB.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({ changes: { from: 0, insert: "B" } });
          }),
        ]);

        // Wait for CRDT convergence
        await userA.page.waitForFunction(
          () => window.__cmView.state.doc.length === 2,
          {},
          { timeout: 5000 }
        );
        await userB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 2,
          {},
          { timeout: 5000 }
        );

        // Should converge to same state (Y.js CRDT resolution)
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);

        expect(contentA).toBe(contentB);
        expect(contentA.length).toBe(2);
        expect(contentA).toMatch(/^[AB][AB]$/);
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await userA.context.close();
        await userB.context.close();
      }
    });
  });

  test.describe("Reconnection Handling", () => {
    test("should sync after disconnect and reconnect", async ({ browser, request }) => {
      const userA = await createAuthenticatedPage(browser, request);

      const userB = await createAuthenticatedPage(browser, request);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(2000);  // Increased from 500ms to test timing hypothesis

        // User A types
        await insertText(userA.page, "Before disconnect");
        await userB.page.waitForTimeout(500);

        // User B navigates away (simulates disconnect)
        await userB.page.goto(`http://localhost:${FRONTEND_PORT}/`);
        await userB.page.waitForTimeout(500);

        // User A types more
        await insertText(userA.page, "\nDuring disconnect");
        await userA.page.waitForTimeout(500);

        // User B reconnects
        await openFileInEditor(userB.page, 1);
        await userB.page.waitForTimeout(1000);

        // User B should have all content
        const contentB = await getEditorContent(userB.page);
        expect(contentB).toContain("Before disconnect");
        expect(contentB).toContain("During disconnect");
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await userA.context.close();
        await userB.context.close();
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
