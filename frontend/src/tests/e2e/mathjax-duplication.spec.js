import { test, expect } from "@playwright/test";
import { AuthHelpers } from "./utils/auth-helpers.js";
import { TEST_CREDENTIALS } from "./setup/test-data.js";

/**
 * MathJax Duplication Bug Regression Test
 *
 * This test reproduces a bug where MathJax elements get duplicated when editing
 * the source code. The root cause is that onload() in RSM is called on every
 * HTML re-render, which creates new MathJax script tags each time instead of
 * using MathJax.typesetPromise() to re-render existing math.
 *
 * Each test creates a fresh file with math content to avoid dependencies on
 * existing test data.
 */

// RSM source with BOTH inline and block math - the math content is FIXED and
// edits are made to the TITLE LINE only, ensuring any mjx-container count
// increase is due to the duplication bug, not new math being added.
// - Inline math: single $ delimiters -> renders as span.math
// - Block math: double $$ delimiters -> renders as div.mathblock
const RSM_SOURCE_WITH_MATH = `:rsm:
# Test Document for MathJax Bug

This document contains inline math $a^2 + b^2 = c^2$ and also $E = mc^2$ here.

Here is block math\\:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

And another block equation\\:

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

::`;

test.describe("RSM Initialization Guard @auth @desktop-only", () => {
  let authHelpers;
  let baseURL;
  let accessToken;
  let testUserId;

  test.beforeEach(async ({ page }) => {
    baseURL = process.env.VITE_API_BASE_URL;
    if (!baseURL) {
      throw new Error("VITE_API_BASE_URL environment variable is required");
    }
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
    accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));
    const userData = await page.evaluate(() => JSON.parse(localStorage.getItem("user")));
    testUserId = userData.id;
  });

  async function createTestFile(request, source) {
    const createResponse = await request.post(`${baseURL}/files`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: "Init Guard Test", owner_id: testUserId, source },
    });
    if (!createResponse.ok()) {
      throw new Error(`File creation failed: ${createResponse.status()}`);
    }
    return (await createResponse.json()).id;
  }

  async function deleteTestFile(request, fileId) {
    try {
      await request.delete(`${baseURL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  test("RSM onload should only initialize once (no infinite import loop)", async ({
    page,
    request,
  }) => {
    // This test catches a bug where dynamic import() creates new module instances,
    // bypassing the initialization guard and causing infinite recursion / stack overflow.
    const source = `:rsm:\n# Test\n\nInline math $x^2$ here.\n::`;
    const fileId = await createTestFile(request, source);

    try {
      // Collect console messages to detect infinite loop
      const consoleLogs = [];
      page.on("console", (msg) => {
        if (msg.text().includes("onload initializing")) {
          consoleLogs.push(msg.text());
        }
      });

      // Collect errors to detect stack overflow
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(`/file/${fileId}`);

      // Wait for manuscript to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Wait for MathJax to actually load (this would timeout if infinite loop occurs)
      await page.waitForFunction(() => typeof window.MathJax !== "undefined", { timeout: 10000 });

      // Check the initialization guard is working
      const initState = await page.evaluate(() => ({
        rsmInitialized: window.__rsmInitialized,
        mathJaxExists: typeof window.MathJax !== "undefined",
        mathJaxScripts: document.querySelectorAll('script[id="MathJax-script"]').length,
      }));

      console.log("Init state:", JSON.stringify(initState));
      console.log("Onload init messages:", consoleLogs.length);
      console.log("Page errors:", errors);

      // CRITICAL: onload should only initialize ONCE (catches infinite import loop)
      // If this fails with a high number, the bug has regressed
      expect(consoleLogs.length).toBeLessThanOrEqual(1);

      // No stack overflow errors (the symptom of infinite import loop)
      const stackOverflows = errors.filter((e) => e.includes("Maximum call stack"));
      expect(stackOverflows).toHaveLength(0);

      // MathJax should have loaded successfully
      expect(initState.mathJaxExists).toBe(true);
      expect(initState.mathJaxScripts).toBe(1);

      // Note: rsmInitialized is an implementation detail of the fix.
      // If undefined, RSM package may not have the fix yet, but if MathJax loaded
      // without stack overflow and only 1 init message, the behavior is correct.
      if (initState.rsmInitialized !== undefined) {
        expect(initState.rsmInitialized).toBe(true);
      }
    } finally {
      await deleteTestFile(request, fileId);
    }
  });

  test("MathJax should render on initial page load (not fail silently)", async ({
    page,
    request,
  }) => {
    // This test ensures MathJax actually renders math on first load.
    // The bug caused MathJax to never load, leaving raw LaTeX visible.
    const source = `:rsm:\n# Math Test\n\nEquation: $E = mc^2$\n\nBlock:\n\n$$\\sum_{i=1}^n i$$\n\n::`;
    const fileId = await createTestFile(request, source);

    try {
      await page.goto(`/file/${fileId}`);

      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Wait for MathJax containers to appear (proves MathJax loaded and ran)
      await page.waitForFunction(() => document.querySelectorAll("mjx-container").length > 0, {
        timeout: 10000,
      });

      // Check for raw LaTeX that should NOT be visible
      const renderCheck = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        const text = manuscript?.textContent || "";
        return {
          hasRawInlineDelimiters: text.includes("\\(") || text.includes("\\)"),
          hasRawBlockDelimiters: text.includes("$$"),
          hasRawDollarMath: /\$[^$]+\$/.test(text) && !text.includes("mjx"),
          mjxContainerCount: document.querySelectorAll("mjx-container").length,
        };
      });

      console.log("Render check:", JSON.stringify(renderCheck));

      // Raw LaTeX should NEVER be visible in rendered output
      expect(renderCheck.hasRawInlineDelimiters).toBe(false);
      expect(renderCheck.hasRawBlockDelimiters).toBe(false);

      // MathJax containers should exist
      expect(renderCheck.mjxContainerCount).toBeGreaterThan(0);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });
});

test.describe("MathJax Duplication Bug @auth @desktop-only", () => {
  let authHelpers;
  let baseURL;
  let accessToken;
  let testUserId;

  test.beforeEach(async ({ page }) => {
    // Get API base URL (required - no fallback)
    baseURL = process.env.VITE_API_BASE_URL;
    if (!baseURL) {
      throw new Error("VITE_API_BASE_URL environment variable is required");
    }

    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();

    // Get access token from localStorage after login
    accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));

    // Get user ID for file creation
    const userData = await page.evaluate(() => JSON.parse(localStorage.getItem("user")));
    testUserId = userData.id;
  });

  /**
   * Helper to create a test file with math content via API
   */
  async function createTestFileWithMath(request) {
    // Create file with source content directly
    const createResponse = await request.post(`${baseURL}/files`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        title: "MathJax Bug Test File",
        owner_id: testUserId,
        source: RSM_SOURCE_WITH_MATH,
      },
    });

    if (!createResponse.ok()) {
      const errorText = await createResponse.text();
      throw new Error(`File creation failed: ${createResponse.status()} - ${errorText}`);
    }

    const fileData = await createResponse.json();
    return fileData.id;
  }

  /**
   * Helper to delete a test file via API
   */
  async function deleteTestFile(request, fileId) {
    try {
      await request.delete(`${baseURL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Wait for MathJax rendering to stabilize by checking container counts
   */
  async function waitForMathJaxStable(page) {
    await page.waitForFunction(
      () => {
        const getState = () => ({
          inline: document.querySelectorAll("span.math > mjx-container").length,
          block: document.querySelectorAll("div.mathblock > .hr-content-zone > mjx-container")
            .length,
          processing: !!document.querySelector(".MathJax_Processing"),
        });

        // Store state for comparison
        if (!window.__mjxStabilityCheck) {
          window.__mjxStabilityCheck = { state: getState(), stableCount: 0 };
          return false;
        }

        const current = getState();
        const prev = window.__mjxStabilityCheck.state;

        if (
          current.inline === prev.inline &&
          current.block === prev.block &&
          !current.processing
        ) {
          window.__mjxStabilityCheck.stableCount++;
        } else {
          window.__mjxStabilityCheck.stableCount = 0;
        }

        window.__mjxStabilityCheck.state = current;

        // Require 3 stable checks (polling at ~100ms intervals via waitForFunction)
        return window.__mjxStabilityCheck.stableCount >= 3;
      },
      { timeout: 5000, polling: 100 }
    );

    // Clean up
    await page.evaluate(() => delete window.__mjxStabilityCheck);
  }

  test("block math equations should not duplicate when editing source", async ({
    page,
    request,
  }) => {
    // Create a fresh test file with math content
    const fileId = await createTestFileWithMath(request);

    try {
      // Navigate to the test file
      await page.goto(`/file/${fileId}`);

      // Wait for manuscript to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 5000,
      });

      // Wait for MathJax to finish rendering both inline and block math
      await page.waitForFunction(
        () => {
          const inline = document.querySelectorAll("span.math > mjx-container").length;
          const block = document.querySelectorAll(
            "div.mathblock > .hr-content-zone > mjx-container"
          ).length;
          return inline > 0 && block > 0;
        },
        { timeout: 5000 }
      );

      // Wait for rendering to stabilize
      await waitForMathJaxStable(page);

      // Count mjx-containers separately for inline and block math
      const initialCounts = await page.evaluate(() => ({
        inline: document.querySelectorAll("span.math > mjx-container").length,
        block: document.querySelectorAll("div.mathblock > .hr-content-zone > mjx-container").length,
      }));

      console.log(`Initial inline MathJax containers: ${initialCounts.inline}`);
      console.log(`Initial block MathJax containers: ${initialCounts.block}`);

      // EXPECTED: 2 inline (span.math) + 2 block (div.mathblock)
      expect(initialCounts.inline).toBe(2);
      expect(initialCounts.block).toBe(2);

      // Open the source editor by clicking the sidebar "source" button
      const editorButton = page.locator(".sb-item").filter({ hasText: "source" });
      await editorButton.click();

      // Wait for editor to be visible
      await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
        timeout: 5000,
      });

      // Wait for the textarea editor to load
      const editor = page.locator("textarea.editor");
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Get current content and modify it
      const currentContent = await editor.inputValue();
      const newContent = currentContent.replace(
        "# Test Document for MathJax Bug",
        "# Test Document for MathJax Bug EDIT1"
      );

      // Set up response wait BEFORE filling to catch the debounced save
      const savePromise = page.waitForResponse(
        (response) => response.url().includes("/files/") && response.request().method() === "PUT",
        { timeout: 15000 }
      );

      // Use fill() which reliably triggers Vue input events
      await editor.fill(newContent);

      // Wait for the save to complete
      await savePromise;

      // Wait for MathJax to finish
      await page.waitForFunction(() => !document.querySelector(".MathJax_Processing"), {
        timeout: 5000,
      });

      // On mobile, switch back to manuscript view
      const viewport = page.viewportSize();
      const isMobile = viewport && viewport.width < 640;
      if (isMobile) {
        const sourceButton = page.locator(".sb-item").filter({ hasText: "source" });
        await sourceButton.click();
        await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        });
      }

      // Check state after first edit
      const afterFirstEdit = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        if (!manuscript) return { error: "no manuscript viewer" };
        const text = manuscript.textContent || "";
        return {
          hasRawInlineLatex: text.includes("\\(") || text.includes("\\)"),
          hasRawBlockLatex: text.includes("$$"),
          titleCount: (text.match(/Test Document for MathJax Bug/g) || []).length,
          scriptCount: document.querySelectorAll('script[id="MathJax-script"]').length,
          inlineMjxCount: document.querySelectorAll("span.math > mjx-container").length,
          blockMjxCount: document.querySelectorAll(
            "div.mathblock > .hr-content-zone > mjx-container"
          ).length,
          nestedMjxCount: document.querySelectorAll("mjx-container mjx-container").length,
        };
      });

      console.log("After first edit:", JSON.stringify(afterFirstEdit));

      // On mobile, switch back to source editor for second edit
      if (isMobile) {
        const sourceButton = page.locator(".sb-item").filter({ hasText: "source" });
        await sourceButton.click();
        await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
          timeout: 5000,
        });
        const editorAgain = page.locator("textarea.editor");
        await editorAgain.click();
      }

      // Get current content and make second edit
      const editorAgainForEdit = isMobile
        ? page.locator("textarea.editor")
        : editor;
      const currentContent2 = await editorAgainForEdit.inputValue();
      const newContent2 = currentContent2.replace("EDIT1", "EDIT1 EDIT2");

      // Set up save wait before second edit
      const savePromise2 = page.waitForResponse(
        (response) => response.url().includes("/files/") && response.request().method() === "PUT",
        { timeout: 15000 }
      );

      // Make another edit
      await editorAgainForEdit.fill(newContent2);

      // Wait for save
      await savePromise2;

      // Wait for MathJax to finish
      await page.waitForFunction(() => !document.querySelector(".MathJax_Processing"), {
        timeout: 5000,
      });

      // On mobile, switch back to manuscript view
      if (isMobile) {
        const sourceButton = page.locator(".sb-item").filter({ hasText: "source" });
        await sourceButton.click();
        await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        });
      }

      const afterSecondEdit = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        const text = manuscript?.textContent || "";
        return {
          hasRawInlineLatex: text.includes("\\(") || text.includes("\\)"),
          hasRawBlockLatex: text.includes("$$"),
          titleCount: (text.match(/Test Document for MathJax Bug/g) || []).length,
          inlineMjxCount: document.querySelectorAll("span.math > mjx-container").length,
          blockMjxCount: document.querySelectorAll(
            "div.mathblock > .hr-content-zone > mjx-container"
          ).length,
          nestedMjxCount: document.querySelectorAll("mjx-container mjx-container").length,
        };
      });

      console.log("After second edit:", JSON.stringify(afterSecondEdit));

      // Raw LaTeX should never be visible
      expect(afterFirstEdit.hasRawInlineLatex).toBe(false);
      expect(afterFirstEdit.hasRawBlockLatex).toBe(false);
      expect(afterSecondEdit.hasRawInlineLatex).toBe(false);
      expect(afterSecondEdit.hasRawBlockLatex).toBe(false);

      // Title should appear exactly once
      expect(afterFirstEdit.titleCount).toBe(1);
      expect(afterSecondEdit.titleCount).toBe(1);

      // Only ONE MathJax script tag
      expect(afterFirstEdit.scriptCount).toBe(1);

      // mjx-container counts should stay the same
      expect(afterFirstEdit.inlineMjxCount).toBe(initialCounts.inline);
      expect(afterFirstEdit.blockMjxCount).toBe(initialCounts.block);
      expect(afterSecondEdit.inlineMjxCount).toBe(initialCounts.inline);
      expect(afterSecondEdit.blockMjxCount).toBe(initialCounts.block);

      // No nested mjx-containers (the duplication bug symptom)
      expect(afterFirstEdit.nestedMjxCount).toBe(0);
      expect(afterSecondEdit.nestedMjxCount).toBe(0);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });

  test("MathJax script tags should not multiply on re-renders", async ({ page, request }) => {
    const fileId = await createTestFileWithMath(request);

    try {
      await page.goto(`/file/${fileId}`);

      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 5000,
      });

      await page.waitForFunction(() => typeof window.MathJax !== "undefined", { timeout: 5000 });

      const initialScriptCount = await page.evaluate(() => {
        return document.querySelectorAll('script[id="MathJax-script"]').length;
      });

      console.log(`Initial MathJax script count: ${initialScriptCount}`);

      // Open editor
      const editorButton = page.locator(".sb-item").filter({ hasText: "source" });
      await editorButton.click();

      await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
        timeout: 5000,
      });

      const editor = page.locator("textarea.editor");
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Make 3 edits and wait for each to save
      let currentContent = await editor.inputValue();

      for (let i = 0; i < 3; i++) {
        // Modify content
        const editMarker = i === 0 ? "# Test Document for MathJax Bug" : `edit${i - 1}`;
        currentContent = currentContent.replace(editMarker, `${editMarker} edit${i}`);

        // Set up wait BEFORE filling
        const savePromise = page.waitForResponse(
          (response) => response.url().includes("/files/") && response.request().method() === "PUT",
          { timeout: 15000 }
        );

        await editor.fill(currentContent);

        // Wait for save
        await savePromise;

        // Wait for MathJax to finish
        await page.waitForFunction(() => !document.querySelector(".MathJax_Processing"), {
          timeout: 5000,
        });
      }

      const finalScriptCount = await page.evaluate(() => {
        return document.querySelectorAll('script[id="MathJax-script"]').length;
      });

      console.log(`Final MathJax script count after 3 edits: ${finalScriptCount}`);

      // Script count should remain 1
      expect(finalScriptCount).toBe(1);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });
});
