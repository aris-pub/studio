/**
 * E2E test for LSP content duplication bug (std-6l1)
 *
 * Tests that content does NOT duplicate when LSP connects.
 * Bug report: Content triplicates on page load when LSP is enabled.
 *
 * Tag: @auth
 *
 * NOTE: This test requires the LSP server to be running (via supervisord).
 * Tests automatically skip when LSP is unavailable (TEST/CI backends).
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

test.describe("LSP Content Duplication Bug @auth", () => {
  const initialContent =
    "# Test Document\n\nThis is a test paragraph.\n\n:theorem:\nContent should not duplicate.\n:/theorem:";

  let auth;
  let fileId;
  let reloadFileId;
  let lspAvailable = false;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);

    // Each test gets its own file to avoid shared Y.js room state
    fileId = await createTestFile(request, auth.token, auth.userData.id, initialContent);
    reloadFileId = await createTestFile(request, auth.token, auth.userData.id, initialContent);

    // Check if LSP is available (only in DEV backend with supervisord)
    const devBackendPort = process.env.BACKEND_PORT || "8000";
    try {
      const response = await fetch(`http://localhost:${devBackendPort}/health`);
      const health = await response.json();
      lspAvailable = health.checks?.services?.status === "healthy";
      if (!lspAvailable) {
        console.log(
          "[LSP Content Duplication Test] Skipping - LSP not available (supervisord services not healthy)"
        );
      }
    } catch {
      console.log(
        "[LSP Content Duplication Test] Skipping - Could not check LSP availability on DEV backend"
      );
    }
  });

  test.afterAll(async ({ request }) => {
    if (fileId) {
      await deleteTestFile(request, auth.token, fileId);
    }
    if (reloadFileId) {
      await deleteTestFile(request, auth.token, reloadFileId);
    }
  });

  test("should NOT duplicate content when LSP connects @auth", async ({ browser }) => {
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      // Wait for editor to be ready
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      // Get content immediately after editor loads (before LSP connects)
      const contentBeforeLSP = await page.evaluate(() => {
        return window.__cmView.state.doc.toString();
      });

      // Wait for Y.js sync to settle before checking for duplication
      await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 15000 });

      // Get content after LSP connects
      const contentAfterLSP = await page.evaluate(() => {
        return window.__cmView.state.doc.toString();
      });

      // Check that content hasn't changed
      expect(contentAfterLSP).toBe(contentBeforeLSP);

      // Check that content matches the original (accounting for Y.js normalization)
      expect(contentAfterLSP.trim()).toBe(initialContent.trim());

      // Check that content hasn't duplicated (length should not be 2x or 3x)
      const contentLengthRatio = contentAfterLSP.length / initialContent.length;
      expect(contentLengthRatio).toBeLessThan(1.5); // Allow some variance but not 2x or 3x

      // Count occurrences of a unique string to verify no duplication
      const uniqueString = "Content should not duplicate.";
      const occurrences = (contentAfterLSP.match(new RegExp(uniqueString, "g")) || []).length;
      expect(occurrences).toBe(1); // Should appear exactly once
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("should maintain correct content after page reload with LSP @auth", async ({ browser }) => {
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      // Uses its own file (reloadFileId) to avoid shared Y.js room state with test above
      await openFileInEditor(page, reloadFileId);
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      const contentAfterFirstLoad = await page.evaluate(() => {
        return window.__cmView.state.doc.toString();
      });
      expect(contentAfterFirstLoad.trim()).toBe(initialContent.trim());

      // Reload the page
      await page.reload({ waitUntil: "commit" });

      // Wait for editor to be ready again
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 15000 }
      );

      // Wait for Y.js sync to complete (content arrives via backend seeding)
      await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 15000 });

      const contentAfterReload = await page.evaluate(() => {
        return window.__cmView.state.doc.toString();
      });

      // Content should be the same after reload
      expect(contentAfterReload.trim()).toBe(initialContent.trim());

      // Count occurrences to verify no duplication happened on reload
      const uniqueString = "Content should not duplicate.";
      const occurrences = (contentAfterReload.match(new RegExp(uniqueString, "g")) || []).length;
      expect(occurrences).toBe(1);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });
});
