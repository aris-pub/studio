/**
 * E2E regression for std-9hfk: Cmd+click on rendered output → source highlight.
 *
 * Bug: cmd+click worked intermittently and appeared to "work once then silently
 * fail". Root cause: rsm/nodePosition returns null while the LSP is still building
 * its nodeid->source index (on cold open and after each recompile), and
 * navigateToSource bailed silently on the first null. Whichever click landed
 * during an index (re)build did nothing, with no highlight and no error. The fix
 * retries nodePosition briefly so cmd+click is reliable.
 *
 * This test drives several consecutive cmd+clicks — including the FIRST one, which
 * is the most likely to hit a cold index — and asserts each highlights the source.
 *
 * Requires the LSP server (DEV backend with supervisord); skips otherwise.
 *
 * Tag: @auth
 */

import { test, expect } from "../fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  cleanupYjs,
} from "../yjs-helpers.js";
import { getTimeouts } from "../utils/timeout-constants.js";

test.describe("Source-preview cmd+click navigation @auth", () => {
  const rsm =
    "# Cmd Click Nav\n\nFirst paragraph of content.\n\nSecond distinct paragraph.\n\n:theorem:\nA theorem body here.\n:/theorem:";

  let auth;
  let fileId;
  let lspAvailable = false;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
    fileId = await createTestFile(request, auth.token, auth.userData.id, rsm);

    const devBackendPort = process.env.BACKEND_PORT || "8000";
    try {
      const response = await fetch(`http://localhost:${devBackendPort}/health`);
      const health = await response.json();
      lspAvailable = health.checks?.services?.status === "healthy";
    } catch {
      lspAvailable = false;
    }
  });

  test.afterAll(async ({ request }) => {
    if (fileId) await deleteTestFile(request, auth.token, fileId);
  });

  test("cmd+click highlights source on every click, including the first @auth", async ({
    browser,
  }) => {
    // In CI the dev backend must have a healthy LSP (supervisord). A missing LSP
    // there is a real failure, not a reason to report green with zero coverage —
    // so fail loudly in CI and only skip locally.
    if (!lspAvailable && process.env.CI) {
      throw new Error("LSP unavailable in CI: expected supervisord LSP services healthy");
    }
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");

    const timeouts = getTimeouts();
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 10000 }
      );
      // Manuscript rendered with multiple addressable nodes.
      await page.waitForFunction(
        () => document.querySelectorAll("[data-nodeid]").length > 1,
        {},
        { timeout: 15000 }
      );

      // Select rendered CONTENT nodes (not positional index, which can land on a
      // structural node with no source mapping). data-nodeid only exists in the
      // rendered manuscript (never the source editor, which holds the same text),
      // and .last() picks the deepest match — the paragraph itself, not an
      // ancestor section. These paragraphs definitely map to source lines.
      const first = page
        .locator("[data-nodeid]", { hasText: "First paragraph of content." })
        .last();
      const second = page
        .locator("[data-nodeid]", { hasText: "Second distinct paragraph." })
        .last();

      // cmd+click a rendered element and assert the source highlight appears. The
      // retry window is ~2s, so allow generous time for the (cold) first click.
      async function cmdClickHighlights(locator, label) {
        await page.evaluate(() =>
          document
            .querySelectorAll(".cm-synctarget-line")
            .forEach((el) => el.classList.remove("cm-synctarget-line"))
        );
        await locator.click({ modifiers: ["Meta"] });
        // The retry budget is ~2s; use the CI-scaled heavy-operation ceiling so a
        // slow-but-succeeding cold index on a loaded runner isn't misread as failure.
        await page.waitForFunction(
          () => document.querySelectorAll(".cm-synctarget-line").length > 0,
          {},
          { timeout: timeouts.heavyOperation }
        );
        const count = await page.evaluate(
          () => document.querySelectorAll(".cm-synctarget-line").length
        );
        expect(count, `source should highlight on ${label}`).toBeGreaterThan(0);
      }

      // First click — the one that used to silently no-op on a cold LSP index.
      await cmdClickHighlights(first, "first click (cold index)");
      // A different content node.
      await cmdClickHighlights(second, "second click, different node");
      // The same node again — must still work (the reported "same element" case).
      await cmdClickHighlights(first, "third click, repeat node");
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });
});
