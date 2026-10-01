/**
 * Measurement + regression for the empty-editor flash on reload (std-rpc4).
 *
 * After the frontend stopped seeding plaintext (std-vopw), a reload used to show an
 * empty editor for ~500ms to 1s until the backend reconnected to the torn-down room
 * and re-broadcast the restored ydoc_state (measured then: synced at 502ms with an
 * empty doc, content at 1003ms). Since then /collab/start awaits the backend client
 * being ready in the room (it restores and broadcasts ydoc_state before returning),
 * and the frontend pre-warms that token before creating the provider (std-3ulu), so
 * by the time the socket syncs the content should already be in the room.
 *
 * This reloads a file that has content and measures, from the reload, when the
 * provider reports synced versus when the doc actually has text. The gap is the
 * flash. It logs the timeline and asserts the gap is small, so it both answers "is
 * the flash still there" and guards against it coming back.
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

// The flash is the window between the provider reporting synced and the doc having
// content. Under ~250ms reads as no flash.
const MAX_FLASH_MS = 250;

test.describe("Y.js reload flash @collab", () => {
  let auth;
  const timeouts = getTimeouts();

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("content is present at sync on reload, not after a visible gap", async ({
    browser,
    request,
  }) => {
    const marker = `RELOAD-FLASH-${Date.now()}`;
    const fileId = await createTestFile(
      request,
      auth.token,
      auth.userData.id,
      `# ${marker}\n\nbody paragraph.`
    );
    const { context, page } = await createAuthenticatedContext(browser, auth);
    try {
      // Initial open: panel open, content seeded and synced.
      await openFileInEditor(page, fileId);
      await page.waitForFunction(
        (m) => (window.__ydoc?.getText("text").toString() || "").includes(m),
        marker,
        { timeout: timeouts.heavyOperation }
      );

      // Reload and measure the timeline from the reload onward.
      await page.reload({ waitUntil: "commit" });
      const timeline = await page.evaluate(
        async ({ m, budget }) => {
          const t0 = performance.now();
          const elapsed = () => performance.now() - t0;
          let tSynced = null;
          let tContent = null;
          while (elapsed() < budget) {
            if (tSynced === null && window.__provider?.synced === true) tSynced = elapsed();
            if (
              tContent === null &&
              (window.__ydoc?.getText("text").toString() || "").includes(m)
            ) {
              tContent = elapsed();
            }
            if (tSynced !== null && tContent !== null) break;
            await new Promise((r) => setTimeout(r, 10));
          }
          return {
            tSynced,
            tContent,
            gap: tSynced !== null && tContent !== null ? tContent - tSynced : null,
          };
        },
        { m: marker, budget: timeouts.heavyOperation }
      );

      // eslint-disable-next-line no-console
      console.log(`[RPC4-MEASURE] ${JSON.stringify(timeline)}`);

      expect(timeline.tSynced).not.toBeNull();
      expect(timeline.tContent).not.toBeNull();
      // Content should land at (or effectively at) sync, so there is no empty-editor
      // window for the user to see.
      expect(timeline.gap).toBeLessThan(MAX_FLASH_MS);
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
