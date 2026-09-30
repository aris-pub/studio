/**
 * E2E tests for panel-independent collaboration (std-hvgpnr).
 *
 * The Y.js session used to live inside the editor panel, so opening a file with
 * the source panel closed (the default) never opened a WebSocket, and annotation
 * anchoring fell back to drifting DOM offsets. The session now lives at the view
 * level (useCollabSession), so it comes up on file open regardless of the panel.
 *
 * These lock down two things no other @collab spec covers, because they all open
 * the panel via openFileInEditor:
 *   1. a file opened with the panel closed still establishes the session, and the
 *      live doc carries the backend-seeded content (so anchoring has the doc), and
 *   2. closing the panel after it was open does not tear the session down.
 *
 * Tag: @collab
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  cleanupYjs,
} from "./yjs-helpers.js";
import { getTimeouts } from "./utils/timeout-constants.js";

const SOURCE_TOGGLE = '[data-testid="workspace-sidebar"] .sb-item:has-text("source") button';

test.describe("Y.js panel-independent session @collab", () => {
  let auth;
  const timeouts = getTimeouts();

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("connects and seeds the doc with the panel never opened", async ({ browser, request }) => {
    const marker = `PANEL-CLOSED-${Date.now()}`;
    const fileId = await createTestFile(
      request,
      auth.token,
      auth.userData.id,
      `# ${marker}\n\nbody paragraph.`
    );
    const { context, page } = await createAuthenticatedContext(browser, auth);
    try {
      await page.goto(`/file/${fileId}`, { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="manuscript-container"]', {
        timeout: timeouts.heavyOperation,
      });

      // The panel is genuinely closed: no CodeMirror, no editor view. This stops
      // the test from passing by accident if something opened the editor.
      await expect(page.locator(".cm-editor")).toHaveCount(0);
      expect(await page.evaluate(() => typeof window.__cmView)).toBe("undefined");

      // The session still comes up and syncs, panel or not.
      await page.waitForFunction(
        () => window.__provider?.synced === true,
        {},
        {
          timeout: timeouts.heavyOperation,
        }
      );

      // The live doc carries the backend-seeded content, which is what annotation
      // anchoring needs.
      await page.waitForFunction(
        (m) => (window.__ydoc?.getText("text").toString() || "").includes(m),
        marker,
        { timeout: timeouts.heavyOperation }
      );
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("keeps the session alive when the panel is closed after being open", async ({
    browser,
    request,
  }) => {
    const fileId = await createTestFile(
      request,
      auth.token,
      auth.userData.id,
      "# Toggle Test\n\nbody paragraph."
    );
    const { context, page } = await createAuthenticatedContext(browser, auth);
    try {
      // Open with the panel, so the editor view exists and the session is synced.
      await openFileInEditor(page, fileId);
      const before = await page.evaluate(() => window.__ydoc.getText("text").toString());

      // Close the panel. The editor unmounts (window.__cmView goes away) but the
      // session is owned by the view, so it must survive.
      await page.click(SOURCE_TOGGLE);
      await page.waitForFunction(
        () => typeof window.__cmView === "undefined",
        {},
        {
          timeout: timeouts.heavyOperation,
        }
      );

      expect(await page.evaluate(() => window.__provider?.synced === true)).toBe(true);
      const after = await page.evaluate(() => window.__ydoc.getText("text").toString());
      expect(after).toBe(before);
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
