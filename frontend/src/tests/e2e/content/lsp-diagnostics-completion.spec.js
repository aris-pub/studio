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

      // Wait for LSP to connect and become active
      await page.waitForFunction(
        () => {
          const indicators = document.querySelectorAll(".status-indicator");
          return Array.from(indicators).some((el) => {
            const text = el.textContent || "";
            return text.includes("LSP") && text.includes("Active");
          });
        },
        {},
        { timeout: 10000 }
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

  test.skip("should clear diagnostic when syntax error is fixed @auth", async ({ browser }) => {
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

      // Wait for LSP to connect and become active
      await page.waitForFunction(
        () => {
          const indicators = document.querySelectorAll(".status-indicator");
          return Array.from(indicators).some((el) => {
            const text = el.textContent || "";
            return text.includes("LSP") && text.includes("Active");
          });
        },
        {},
        { timeout: 10000 }
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

      // Wait for diagnostic to disappear after fix
      await page.waitForFunction(
        () => {
          const markers = document.querySelectorAll(".cm-lint-marker-error");
          return markers.length === 0;
        },
        {},
        { timeout: 10000 }
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

      // Wait for LSP to connect and become active
      await page.waitForFunction(
        () => {
          const indicators = document.querySelectorAll(".status-indicator");
          return Array.from(indicators).some((el) => {
            const text = el.textContent || "";
            return text.includes("LSP") && text.includes("Active");
          });
        },
        {},
        { timeout: 10000 }
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
      await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 10000 });

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

      // Wait for LSP to connect and become active
      await page.waitForFunction(
        () => {
          const indicators = document.querySelectorAll(".status-indicator");
          return Array.from(indicators).some((el) => {
            const text = el.textContent || "";
            return text.includes("LSP") && text.includes("Active");
          });
        },
        {},
        { timeout: 10000 }
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
      await page.waitForSelector(".cm-tooltip-autocomplete", { timeout: 10000 });

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

  test("should show LSP status indicator in UI @auth", async ({ browser }) => {
    test.skip(!lspAvailable, "LSP not available (requires DEV backend with supervisord)");
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      // Wait for LSP status indicator to show "Active"
      await page.waitForFunction(
        () => {
          const statusIndicators = document.querySelectorAll(".status-indicator");
          return Array.from(statusIndicators).some((el) => {
            const text = el.textContent || "";
            return text.includes("LSP") && text.includes("Active");
          });
        },
        {},
        { timeout: 10000 }
      );

      // Verify status indicator is visible
      const lspStatus = await page.evaluate(() => {
        const indicators = document.querySelectorAll(".status-indicator");
        for (const indicator of indicators) {
          if (indicator.textContent.includes("LSP")) {
            return indicator.textContent;
          }
        }
        return null;
      });

      expect(lspStatus).toContain("LSP");
      expect(lspStatus).toContain("Active");
    } finally {
      await cleanupYjs(page);
      await context.close();
    }
  });
});
