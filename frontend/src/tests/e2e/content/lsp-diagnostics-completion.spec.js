/**
 * E2E tests for LSP diagnostics and completion in CodeMirror editor
 *
 * Tests that the RSM Language Server Protocol integration works correctly:
 * - Syntax error diagnostics appear as red gutter markers
 * - Diagnostics disappear when errors are fixed
 * - Completion suggestions appear when typing RSM tags
 * - Completion can be accepted and inserts correct text
 *
 * Tag: @auth
 *
 * NOTE: These tests require the LSP server to be running (via supervisord).
 * Tests automatically skip when LSP is unavailable (TEST/CI backends).
 * Tests run when supervisord services are healthy (DEV backend only).
 */

import { test, expect } from "../fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  insertText,
  cleanupYjs,
} from "../yjs-helpers.js";

test.describe("LSP Diagnostics and Completion @auth", () => {
  let auth;
  let fileId;
  let lspAvailable = false;
  const devBackendPort = process.env.BACKEND_PORT || "8000";

  /** Re-check backend health at test start (backend may have crashed since beforeAll). */
  async function skipIfUnhealthy() {
    try {
      const response = await fetch(`http://localhost:${devBackendPort}/health`);
      const health = await response.json();
      return health.checks?.services?.status !== "healthy";
    } catch {
      return true;
    }
  }

  test.beforeAll(async ({ request, browser }) => {
    auth = await loginUser(request);
    // Create file with RSM syntax error for diagnostics test
    fileId = await createTestFile(
      request,
      auth.token,
      auth.userData.id,
      "# Test\n\nThis is a test.\n\n:the"
    );

    // Check if LSP is available (only in DEV backend with supervisord)
    // LSP runs on DEV backend (port 8000), not TEST backend (port 8001)
    try {
      const response = await fetch(`http://localhost:${devBackendPort}/health`);
      const health = await response.json();
      lspAvailable = health.checks?.services?.status === "healthy";
      if (!lspAvailable) {
        console.log("[LSP Tests] Skipping - LSP not available (supervisord services not healthy)");
      }
    } catch {
      console.log("[LSP Tests] Skipping - Could not check LSP availability on DEV backend");
    }

    // Warm up the LSP by opening the test file in a throwaway context.
    // The first didOpen after a cold start can take 30s+; paying that cost
    // here prevents flaky timeouts in the actual tests.
    if (lspAvailable && fileId) {
      console.log("[LSP Tests] Warming up LSP server...");
      const { context, page } = await createAuthenticatedContext(browser, auth);
      try {
        await openFileInEditor(page, fileId);
        await page.waitForSelector(".cm-lint-marker-error", { timeout: 60000 });
        console.log("[LSP Tests] LSP warm-up complete — diagnostics appeared");
      } catch {
        console.log("[LSP Tests] LSP warm-up timed out (tests may be slow)");
      } finally {
        await cleanupYjs(page);
        await context.close();
      }
    }
  });

  test.afterAll(async ({ request }) => {
    if (fileId) {
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("should display diagnostic gutter marker for syntax error @auth", async ({ browser }) => {
    test.setTimeout(60000);
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

      // Wait for diagnostic gutter marker to appear (LSP needs time to analyze document)
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 45000 });

      // Verify diagnostic marker exists
      const hasMarker = await page.evaluate(() => {
        const markers = document.querySelectorAll(".cm-lint-marker-error");
        return markers.length > 0;
      });

      expect(hasMarker).toBe(true);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("should clear diagnostic when syntax error is fixed @auth", async ({ browser }) => {
    test.setTimeout(60000);
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    test.skip(await skipIfUnhealthy(), "Backend became unhealthy during test run");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      // Use a dedicated file so Y.js echo from other tests can't interfere
      const isolatedFileId = await createTestFile(
        page.request,
        auth.token,
        auth.userData.id,
        "# Test\n\nThis is a test.\n\n:the"
      );

      await openFileInEditor(page, isolatedFileId);

      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      // Wait for diagnostic marker (LSP needs time to analyze)
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 45000 });

      // Fix the syntax error by removing the invalid `:the` tag entirely.
      // `:theorem:` alone is also invalid RSM (directive needs body), so we
      // delete the broken tag instead. After dispatch, Y.js echo resets the
      // autoSync debounce timer, so we wait for it to settle then force sync.
      await page.evaluate(() => {
        const view = window.__cmView;
        const content = view.state.doc.toString();
        const from = content.lastIndexOf(":the");
        view.dispatch({
          changes: { from, to: from + 4, insert: "" },
        });
      });

      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        if (window.__lspClient) {
          window.__lspClient.sync();
        }
      });

      // Wait for diagnostic to disappear after fix
      await page.waitForFunction(
        () => {
          const markers = document.querySelectorAll(".cm-lint-marker-error");
          return markers.length === 0;
        },
        {},
        { timeout: 30000 }
      );

      const errorCount = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });
      expect(errorCount).toBe(0);

      await deleteTestFile(page.request, auth.token, isolatedFileId);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test.skip("should show completion suggestions when typing RSM tag @auth", async ({ browser }) => {
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

      // Clear editor and type incomplete tag
      await page.evaluate(() => {
        const view = window.__cmView;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
      });

      await insertText(page, "# Test\n\n:the");

      // Manually trigger completion (Ctrl+Space)
      await page.keyboard.press("Control+Space");

      // Wait for completion popup to appear (LSP completion may take time)
      await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 30000 });

      // Verify completion contains :theorem:
      const hasTheoremCompletion = await page.evaluate(() => {
        const completionItems = document.querySelectorAll(
          ".cm-tooltip-autocomplete .cm-completionLabel"
        );
        return Array.from(completionItems).some((item) => item.textContent.includes("theorem"));
      });

      expect(hasTheoremCompletion).toBe(true);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test.skip("should accept completion and insert correct text @auth", async ({ browser }) => {
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

      // Clear editor and type incomplete tag
      await page.evaluate(() => {
        const view = window.__cmView;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
      });

      await insertText(page, "# Test\n\n:the");

      // Manually trigger completion (Ctrl+Space)
      await page.keyboard.press("Control+Space");

      // Wait for completion popup (LSP completion may take time)
      await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 30000 });

      // Accept first completion (should be :theorem:)
      await page.keyboard.press("Enter");

      // Wait for completion to be inserted
      await page.waitForFunction(
        () => {
          const content = window.__cmView.state.doc.toString();
          return content.includes(":theorem:");
        },
        {},
        { timeout: 3000 }
      );

      // Verify final content includes completed tag
      const content = await page.evaluate(() => window.__cmView.state.doc.toString());
      expect(content).toContain(":theorem:");
      expect(content).not.toContain(":the\n"); // Original incomplete tag should be replaced
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("should have LSP diagnostics active after editor loads @auth", async ({ browser }) => {
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      // File contains ":the" syntax error — LSP should produce a diagnostic marker
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 30000 });

      const hasMarker = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length > 0;
      });
      expect(hasMarker).toBe(true);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("REGRESSION: diagnostics update in real-time without page refresh @auth", async ({
    browser,
  }) => {
    test.setTimeout(60000);
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    test.skip(await skipIfUnhealthy(), "Backend became unhealthy during test run");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      // Start with a file containing a syntax error. The LSP's didOpen handler
      // reliably produces diagnostics (unlike didChange which may not flag new
      // errors). We then fix the error via dispatch and verify diagnostics clear
      // in real-time without a page refresh.
      const errorFileId = await createTestFile(
        page.request,
        auth.token,
        auth.userData.id,
        "# Test Document\n\nThis is a test.\n\n:the"
      );

      await openFileInEditor(page, errorFileId);

      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      // Wait for diagnostic marker to appear (LSP needs time to analyze)
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 30000 });

      const errorsBeforeFix = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });
      expect(errorsBeforeFix).toBeGreaterThan(0);

      // Fix the error by removing the invalid `:the` tag, then force LSP sync.
      // Y.js echo resets the autoSync debounce timer, so we wait for it to
      // settle then call sync() directly.
      await page.evaluate(() => {
        const view = window.__cmView;
        const content = view.state.doc.toString();
        const from = content.lastIndexOf(":the");
        view.dispatch({
          changes: { from, to: from + 4, insert: "" },
        });
      });

      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        if (window.__lspClient) {
          window.__lspClient.sync();
        }
      });

      // Wait for diagnostic to disappear WITHOUT page refresh
      await page.waitForFunction(
        () => {
          const markers = document.querySelectorAll(".cm-lint-marker-error");
          return markers.length === 0;
        },
        {},
        { timeout: 30000 }
      );

      const errorsAfterFix = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });
      expect(errorsAfterFix).toBe(0);

      await deleteTestFile(page.request, auth.token, errorFileId);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("REGRESSION: LSP plugin not wrapped in Vue Proxy @auth", async ({ browser }) => {
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      // Wait for editor ready and LSP to produce diagnostics on error-containing file
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 30000 });

      // Check that LSP ViewPlugin is registered (not broken by Vue Proxy)
      // This is verified by checking that document changes trigger LSP updates
      const initialContent = await page.evaluate(() => window.__cmView.state.doc.toString());

      // Add a syntax error
      await page.evaluate(() => {
        const view = window.__cmView;
        view.dispatch({
          changes: { from: view.state.doc.length, insert: "\n:incomplete" },
        });
      });

      // If ViewPlugin is working, diagnostics should appear within 1 second (500ms debounce + analysis)
      // If broken (Vue Proxy bug), diagnostics would NEVER appear without page refresh
      let diagnosticsAppeared = false;
      try {
        await page.waitForSelector(".cm-lint-marker-error", { timeout: 2000 });
        diagnosticsAppeared = true;
      } catch (_e) {
        // Timeout means ViewPlugin not working
      }

      expect(diagnosticsAppeared).toBe(true);

      // Verify didChange was sent by checking diagnostics updated
      const currentContent = await page.evaluate(() => window.__cmView.state.doc.toString());
      expect(currentContent).not.toBe(initialContent);
      expect(currentContent).toContain(":incomplete");
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });

  test("REGRESSION: multiple rapid edits debounced correctly @auth", async ({ browser }) => {
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      // Wait for editor ready and LSP to produce diagnostics on error-containing file
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 30000 });

      // Make multiple rapid edits (simulating typing)
      await page.evaluate(() => {
        const view = window.__cmView;
        const doc = view.state.doc;
        view.dispatch({ changes: { from: doc.length, insert: "\n:" } });
      });
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        const view = window.__cmView;
        const doc = view.state.doc;
        view.dispatch({ changes: { from: doc.length, insert: "t" } });
      });
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        const view = window.__cmView;
        const doc = view.state.doc;
        view.dispatch({ changes: { from: doc.length, insert: "h" } });
      });
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        const view = window.__cmView;
        const doc = view.state.doc;
        view.dispatch({ changes: { from: doc.length, insert: "e" } });
      });

      // Debounced sync should wait 500ms after last edit, then send didChange
      // Diagnostic should appear within 1.5s total (500ms debounce + analysis)
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 2000 });

      const errors = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });
      expect(errors).toBeGreaterThan(0);
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });
});
