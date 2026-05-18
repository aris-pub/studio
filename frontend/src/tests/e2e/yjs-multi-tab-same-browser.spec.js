/**
 * E2E regression: Y.js multi-tab in the SAME BROWSER with REAL KEYBOARD input.
 *
 * Why this test exists:
 *   yjs-multi-tab.spec.js uses `browser.newContext()` per tab, which means each
 *   tab is an isolated browser session. y-websocket's BroadcastChannel does
 *   not bridge isolated contexts, so those tests only exercise the WebSocket
 *   relay path.
 *
 *   In the real world a user opens two tabs in the same Chrome window. Both
 *   tabs share a context, so y-websocket's BroadcastChannel is active in
 *   addition to the WebSocket relay. That path needs its own coverage.
 *
 *   On 2026-05-18, a manual review of PR #405 (multi-player WS auth) flagged
 *   that step-2 of the review checklist ("Open the same file in two tabs in
 *   the same browser, type in both") left tab 1 with a frozen editor and a
 *   cascade of CodeMirror "No tile at position undefined" errors in the
 *   console. The existing test suite did not catch this — separate-context
 *   sync passed, while same-context sync was broken.
 *
 * What this test guarantees:
 *   - Sync works between two pages of the same context.
 *   - After a remote (BroadcastChannel-delivered) edit lands, the receiving
 *     tab's editor is still interactive — `view.state.selection.main.head` is
 *     a real number, the CodeMirror DOM accepts clicks, and a subsequent
 *     keyboard keystroke makes it into the document.
 *   - No "No tile at position undefined" (or any CodeMirror measure-cycle
 *     error) shows up on the page console during the interaction.
 *
 * Tag: @collab
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openSecondTab,
  openFileInEditor,
  clearEditor,
  getEditorContent,
  waitForSync,
  cleanupYjs,
} from "./yjs-helpers.js";

function attachConsoleCapture(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

test.describe("Y.js multi-tab — SAME browser context, real keyboard @collab", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("two tabs in one context: keyboard input in tab B does not freeze tab A's editor", async ({
    browser,
    request,
  }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const tabA = await createAuthenticatedContext(browser, auth);
    const tabBPage = await openSecondTab(tabA.context, auth);

    const errorsA = attachConsoleCapture(tabA.page);
    const errorsB = attachConsoleCapture(tabBPage);

    try {
      await openFileInEditor(tabA.page, fileId);
      await openFileInEditor(tabBPage, fileId);

      await clearEditor(tabA.page);
      await tabBPage.waitForFunction(
        () => window.__cmView.state.doc.length === 0,
        {},
        { timeout: 5000 }
      );

      // Real keyboard input in tab B (mirrors what a human types).
      await tabBPage.click(".cm-content");
      await tabBPage.keyboard.type("hello from tab B", { delay: 30 });

      // Tab A receives the edit via BroadcastChannel + WebSocket.
      await waitForSync(tabA.page, "hello from tab B");

      // CRITICAL: tab A's selection must still be a valid number so the
      // CodeMirror measure cycle (updateSelection → domAtPos → resolveBlock)
      // does not throw "No tile at position undefined".
      const selA = await tabA.page.evaluate(() => {
        const main = window.__cmView.state.selection.main;
        return {
          anchor: main.anchor,
          head: main.head,
          from: main.from,
          to: main.to,
          docLen: window.__cmView.state.doc.length,
        };
      });
      expect(typeof selA.anchor).toBe("number");
      expect(typeof selA.head).toBe("number");
      expect(Number.isFinite(selA.anchor)).toBe(true);
      expect(Number.isFinite(selA.head)).toBe(true);
      expect(selA.anchor).toBeGreaterThanOrEqual(0);
      expect(selA.anchor).toBeLessThanOrEqual(selA.docLen);

      // Tab A's editor must still be interactive: clicking + typing should
      // produce visible changes. If updateSelection had been throwing in a
      // measure-cycle loop, the editor would be frozen here.
      await tabA.page.click(".cm-content");
      await tabA.page.keyboard.type(" + reply from A", { delay: 30 });
      await tabA.page.waitForFunction(
        () => window.__cmView.state.doc.toString().includes("reply from A"),
        {},
        { timeout: 5000 }
      );
      await waitForSync(tabBPage, "reply from A");

      const contentA = await getEditorContent(tabA.page);
      const contentB = await getEditorContent(tabBPage);
      expect(contentA).toBe(contentB);
      expect(contentA).toContain("hello from tab B");
      expect(contentA).toContain("reply from A");

      // The screenshot in the PR review showed dozens of these in the console.
      // Any single occurrence is a regression of the bug we're locking down.
      const tileErrors = [...errorsA, ...errorsB].filter((e) => e.includes("No tile at position"));
      expect(tileErrors, `Unexpected CodeMirror tile errors:\n${tileErrors.join("\n")}`).toEqual(
        []
      );
    } finally {
      await cleanupYjs(tabA.page);
      await cleanupYjs(tabBPage);
      await tabBPage.close();
      await tabA.context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("two tabs in one context: simultaneous keyboard typing keeps both editors interactive", async ({
    browser,
    request,
  }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const tabA = await createAuthenticatedContext(browser, auth);
    const tabBPage = await openSecondTab(tabA.context, auth);

    const errorsA = attachConsoleCapture(tabA.page);
    const errorsB = attachConsoleCapture(tabBPage);

    try {
      await openFileInEditor(tabA.page, fileId);
      await openFileInEditor(tabBPage, fileId);

      await clearEditor(tabA.page);
      await tabBPage.waitForFunction(
        () => window.__cmView.state.doc.length === 0,
        {},
        { timeout: 5000 }
      );

      // Type in tab A first, then tab B — alternating, like a real user
      // switching tabs. This is what the manual review did.
      await tabA.page.click(".cm-content");
      await tabA.page.keyboard.type("AAAA", { delay: 30 });
      await waitForSync(tabBPage, "AAAA");

      await tabBPage.click(".cm-content");
      await tabBPage.keyboard.type("BBBB", { delay: 30 });
      await waitForSync(tabA.page, "BBBB");

      // Back to tab A — the bug presented as "I can't type or even click on
      // the source editor on tab 1 anymore". This is the exact failure mode.
      await tabA.page.click(".cm-content");
      await tabA.page.keyboard.type("CCCC", { delay: 30 });
      await tabA.page.waitForFunction(
        () => window.__cmView.state.doc.toString().includes("CCCC"),
        {},
        { timeout: 5000 }
      );
      await waitForSync(tabBPage, "CCCC");

      const contentA = await getEditorContent(tabA.page);
      const contentB = await getEditorContent(tabBPage);
      expect(contentA).toBe(contentB);
      for (const needle of ["AAAA", "BBBB", "CCCC"]) {
        expect(contentA).toContain(needle);
      }

      const tileErrors = [...errorsA, ...errorsB].filter((e) => e.includes("No tile at position"));
      expect(tileErrors, `Unexpected CodeMirror tile errors:\n${tileErrors.join("\n")}`).toEqual(
        []
      );
    } finally {
      await cleanupYjs(tabA.page);
      await cleanupYjs(tabBPage);
      await tabBPage.close();
      await tabA.context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
