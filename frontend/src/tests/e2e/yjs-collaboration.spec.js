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

// Test user credentials
const TEST_USER_EMAIL = "testuser@aris.pub";
const TEST_USER_PASSWORD = "testpassword";

// Helper to create authenticated session
async function createAuthenticatedPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate and inject tokens
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.evaluate(`
    localStorage.setItem('accessToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzcwMjIxNzM3fQ.mpcn96aimju7TOH-dSfZV34euEH1UQmTlnNcUWOMJ4c');
    localStorage.setItem('refreshToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzcwMjIxNzM3LCJ0eXBlIjoicmVmcmVzaCJ9.qourOZ_dTRY0Ou7K5wWSpM_8kLR6m52r-o7_2hqe6H4');
    localStorage.setItem('user', '{"email": "testuser@aris.pub", "id": 1, "name": "Test User", "initials": null, "created_at": "2026-02-03T16:15:02.946491+00:00", "avatar_color": null, "email_verified": false}');
  `);

  return { context, page };
}

// Helper to open file and editor
async function openFileInEditor(page, fileId) {
  await page.goto(`http://localhost:5173/file/${fileId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });
  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  // Wait for __cmView to be available
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  // Wait for Y.js initial sync
  await page.waitForTimeout(1000);
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
  const startLength = await page.evaluate(() => window.__cmView.state.doc.length);
  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
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
  // Extra buffer for Y.js propagation
  await page.waitForTimeout(100);
}

// Helper to clear editor
async function clearEditor(page) {
  // Ensure __cmView is available
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: "" },
    });
  });
  // Wait for editor to actually be empty (Y.js sync complete)
  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });
  // Extra buffer for Y.js propagation
  await page.waitForTimeout(100);
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
    test("should not duplicate keystrokes when typing", async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

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

    test("should handle rapid typing without duplication", async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

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

    test("should handle delete operations correctly", async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

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
    test("should sync text from User A to User B", async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);

      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

        // User A types
        const testText = `User A: ${Date.now()}`;
        await insertText(userA.page, testText);
        await userB.page.waitForTimeout(1000);

        // User B should see User A's text
        const contentB = await getEditorContent(userB.page);
        expect(contentB).toContain(testText);
      } finally {
        await cleanupYjs(userA.page);
        await cleanupYjs(userB.page);
        await userA.context.close();
        await userB.context.close();
      }
    });

    test("should sync text from User B to User A @flaky", async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);

      const userB = await createAuthenticatedPage(browser);

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

    test("should handle bidirectional edits correctly @flaky", async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);

      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

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
    test("should sync between three users simultaneously", async ({ browser }) => {
      test.setTimeout(30000); // 30s timeout for complex 3-user scenario
      const userA = await createAuthenticatedPage(browser);

      const userB = await createAuthenticatedPage(browser);
      const userC = await createAuthenticatedPage(browser);

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
    test("should handle simultaneous edits at different positions @flaky", async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);

      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

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

    test("should handle conflicting edits at same position", async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);

      const userB = await createAuthenticatedPage(browser);

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
    test("should sync after disconnect and reconnect", async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);

      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

        // User A types
        await insertText(userA.page, "Before disconnect");
        await userB.page.waitForTimeout(500);

        // User B navigates away (simulates disconnect)
        await userB.page.goto("http://localhost:5173/");
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
    test("should handle large document without lag", async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

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
