/**
 * E2E tests for Y.js - SINGLE USER, MULTIPLE TABS
 *
 * Tests Y.js synchronization when the same user has multiple browser tabs open.
 * Verifies bidirectional sync, concurrent edits, and CRDT conflict resolution.
 *
 * Tag: @collab
 *
 * Scope: studio-elz (Y.js: Same user, multiple tabs - self-collaboration)
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
  waitForSync,
  cleanupYjs,
} from "./yjs-helpers.js";

test.describe("Y.js Single User, Multiple Tabs @collab", () => {
  let auth;
  let sharedFileId;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
    sharedFileId = await createTestFile(request, auth.token, auth.userData.id);
  });

  test.afterAll(async ({ request }) => {
    await deleteTestFile(request, auth.token, sharedFileId);
  });

  test.describe("Two Tabs - Bidirectional Sync", () => {
    test("should sync text from Tab A to Tab B", async ({ browser }) => {
      const tabA = await createAuthenticatedContext(browser, auth);
      const tabB = await createAuthenticatedContext(browser, auth);

      try {
        await openFileInEditor(tabA.page, sharedFileId);
        await openFileInEditor(tabB.page, sharedFileId);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        const testText = `Tab A: ${Date.now()}`;
        await insertText(tabA.page, testText);
        await waitForSync(tabB.page, testText);

        const contentB = await getEditorContent(tabB.page);
        expect(contentB).toContain(testText);
      } finally {
        await cleanupYjs(tabA.page);
        await cleanupYjs(tabB.page);
        await tabA.context.close();
        await tabB.context.close();
      }
    });

    test("should sync text from Tab B to Tab A @flaky", async ({ browser }) => {
      const tabA = await createAuthenticatedContext(browser, auth);
      const tabB = await createAuthenticatedContext(browser, auth);

      try {
        await openFileInEditor(tabA.page, sharedFileId);
        await openFileInEditor(tabB.page, sharedFileId);

        await clearEditor(tabB.page);
        await tabA.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

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

    test("should handle bidirectional edits correctly @flaky", async ({ browser }) => {
      const tabA = await createAuthenticatedContext(browser, auth);
      const tabB = await createAuthenticatedContext(browser, auth);

      try {
        await openFileInEditor(tabA.page, sharedFileId);
        await openFileInEditor(tabB.page, sharedFileId);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

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
    test("should sync between three tabs simultaneously", async ({ browser }) => {
      test.setTimeout(30000);
      const tabA = await createAuthenticatedContext(browser, auth);
      const tabB = await createAuthenticatedContext(browser, auth);
      const tabC = await createAuthenticatedContext(browser, auth);

      try {
        await openFileInEditor(tabA.page, sharedFileId);
        await openFileInEditor(tabB.page, sharedFileId);
        await openFileInEditor(tabC.page, sharedFileId);

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
    test("should handle simultaneous edits at different positions @flaky", async ({ browser }) => {
      const tabA = await createAuthenticatedContext(browser, auth);
      const tabB = await createAuthenticatedContext(browser, auth);

      try {
        await openFileInEditor(tabA.page, sharedFileId);
        await openFileInEditor(tabB.page, sharedFileId);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        await insertText(tabA.page, "START___END");
        await waitForSync(tabB.page, "START___END");

        await Promise.all([
          tabA.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({ changes: { from: 5, to: 8, insert: "MIDDLE" } });
          }),
          tabB.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({ changes: { from: 0, to: 0, insert: "BEGIN-" } });
          }),
        ]);

        await Promise.all([waitForSync(tabA.page, "BEGIN"), waitForSync(tabB.page, "BEGIN")]);

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

    test("should handle conflicting edits at same position", async ({ browser }) => {
      const tabA = await createAuthenticatedContext(browser, auth);
      const tabB = await createAuthenticatedContext(browser, auth);

      try {
        await openFileInEditor(tabA.page, sharedFileId);
        await openFileInEditor(tabB.page, sharedFileId);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        await Promise.all([
          tabA.page.evaluate(() => {
            window.__cmView.dispatch({ changes: { from: 0, insert: "A" } });
          }),
          tabB.page.evaluate(() => {
            window.__cmView.dispatch({ changes: { from: 0, insert: "B" } });
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
    test("should sync after disconnect and reconnect", async ({ browser }) => {
      const tabA = await createAuthenticatedContext(browser, auth);
      const tabB = await createAuthenticatedContext(browser, auth);

      try {
        await openFileInEditor(tabA.page, sharedFileId);
        await openFileInEditor(tabB.page, sharedFileId);

        await clearEditor(tabA.page);
        await tabB.page.waitForFunction(
          () => window.__cmView.state.doc.length === 0,
          {},
          { timeout: 5000 }
        );

        await insertText(tabA.page, "Before disconnect");
        await waitForSync(tabB.page, "Before disconnect");

        // Navigate away to simulate disconnect
        await tabB.page.goto("/", { waitUntil: "commit" });

        await insertText(tabA.page, "\nDuring disconnect");

        // Reconnect
        await openFileInEditor(tabB.page, sharedFileId);

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
