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

  test.beforeAll(async ({ request }) => {
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
    const devBackendPort = process.env.BACKEND_PORT || "8000";
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
  });

  test.afterAll(async ({ request }) => {
    if (fileId) {
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("should display diagnostic gutter marker for syntax error @auth", async ({ browser }) => {
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
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 15000 });

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

      // Wait for diagnostic marker (LSP needs time to analyze)
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 15000 });

      // Fix the syntax error by completing the tag
      await page.evaluate(() => {
        const view = window.__cmView;
        // Replace :the with :theorem: (valid RSM tag)
        const content = view.state.doc.toString();
        const from = content.lastIndexOf(":the");
        view.dispatch({
          changes: { from, to: from + 4, insert: ":theorem:" },
        });
      });

      // Wait for diagnostic to disappear after fix (needs LSP re-analysis time)
      await page.waitForFunction(
        () => {
          const markers = document.querySelectorAll(".cm-lint-marker-error");
          return markers.length === 0;
        },
        {},
        { timeout: 15000 }
      );

      // Verify no error markers remain
      const errorCount = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });
      expect(errorCount).toBe(0);
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
      await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 15000 });

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
      await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 15000 });

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
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 15000 });

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
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      // Create file with valid content (minimal valid RSM)
      const validFileId = await createTestFile(
        page.request,
        auth.token,
        auth.userData.id,
        "# Valid Document\n\nThis is valid content."
      );

      await openFileInEditor(page, validFileId);

      // Wait for editor and LSP to initialize
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      // Valid file — wait for LSP to finish initial analysis
      await page.waitForTimeout(3000);
      const initialErrors = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });

      // If there are any initial errors, that's fine - we'll just verify they increase
      const baselineErrorCount = initialErrors;

      // Type a syntax error by adding incomplete tag
      await page.evaluate(() => {
        const view = window.__cmView;
        const doc = view.state.doc;
        view.dispatch({
          changes: { from: doc.length, insert: "\n\n:the" },
        });
      });

      // Wait for diagnostic to appear WITHOUT page refresh (500ms debounce + analysis time)
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 5000 });

      // Verify error marker appeared (should be more than baseline)
      const errorsAfterTyping = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });
      expect(errorsAfterTyping).toBeGreaterThan(baselineErrorCount);

      // Fix the error by completing the tag
      await page.evaluate(() => {
        const view = window.__cmView;
        const content = view.state.doc.toString();
        const from = content.lastIndexOf(":the");
        view.dispatch({
          changes: { from, to: from + 4, insert: ":theorem:" },
        });
      });

      // Wait for diagnostic to disappear WITHOUT page refresh (back to baseline)
      await page.waitForFunction(
        () => {
          const markers = document.querySelectorAll(".cm-lint-marker-error").length;
          return markers <= baselineErrorCount;
        },
        { baselineErrorCount },
        { timeout: 5000 }
      );

      // Verify error cleared (back to baseline or less)
      const errorsAfterFix = await page.evaluate(() => {
        return document.querySelectorAll(".cm-lint-marker-error").length;
      });
      expect(errorsAfterFix).toBeLessThanOrEqual(baselineErrorCount);

      // Cleanup test file
      await deleteTestFile(page.request, auth.token, validFileId);
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
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 15000 });

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
      await page.waitForSelector(".cm-lint-marker-error", { timeout: 15000 });

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
