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

test.describe("RSM Initialization Guard @auth", () => {
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

test.describe("MathJax Duplication Bug @auth", () => {
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

  test("block math equations should not duplicate when editing source", async ({
    page,
    request,
  }) => {
    // Capture diagnostic logs for debugging mobile MathJax issue
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("[ManuscriptWrapper]") ||
        text.includes("[RSM onload]") ||
        text.includes("[RSM onrender]") ||
        text.includes("[typesetMath]")
      ) {
        console.log("BROWSER:", text);
      }
    });

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
      // Block math structure: div.mathblock > div.hr-content-zone > mjx-container
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

      // Wait for rendering to stabilize (no new containers for 500ms)
      let lastInline = 0;
      let lastBlock = 0;
      let stableCount = 0;
      while (stableCount < 3) {
        await page.waitForTimeout(500);
        const { inline, block } = await page.evaluate(() => ({
          inline: document.querySelectorAll("span.math > mjx-container").length,
          block: document.querySelectorAll("div.mathblock > .hr-content-zone > mjx-container")
            .length,
        }));
        if (inline === lastInline && block === lastBlock) {
          stableCount++;
        } else {
          stableCount = 0;
          lastInline = inline;
          lastBlock = block;
        }
      }

      // Count mjx-containers separately for inline and block math
      // - Inline: span.math > mjx-container (direct child)
      // - Block: div.mathblock > .hr-content-zone > mjx-container (nested in handrails zone)
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

      // IMPORTANT: We edit the TITLE LINE (line 2: "# Test Document..."), which is
      // plain text and does NOT contain any math. This ensures that any increase in
      // mjx-container count is due to the duplication bug, not because we're adding
      // new math content.
      await editor.click();

      // Navigate to line 2 (the title line) and add text there
      await page.keyboard.press("Control+Home"); // Go to beginning
      await page.keyboard.press("ArrowDown"); // Line 2 (title)
      await page.keyboard.press("End");
      await page.keyboard.type(" EDIT1");

      // Wait for the re-render to complete (editor has debounce)
      await page.waitForTimeout(3000);

      // Wait for MathJax to process the update
      await page.waitForFunction(() => !document.querySelector(".MathJax_Processing"), {
        timeout: 5000,
      });

      // On mobile, switch back to manuscript view to check the rendered output
      // Mobile UI: toggle items (source, Ari, search) are in the bottom bar as .sb-item
      // There is NO "manuscript" button - manuscript is the default view shown when
      // all toggles are OFF. Click "source" again to toggle it OFF and show manuscript.
      const viewport = page.viewportSize();
      const isMobile = viewport && viewport.width < 640;
      if (isMobile) {
        const sourceButton = page.locator(".sb-item").filter({ hasText: "source" });
        await sourceButton.click(); // Toggle OFF to hide editor, show manuscript
        await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        });
      }

      // Check state after first edit - includes mjx-container counts
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
          totalMjxCount: document.querySelectorAll("mjx-container").length,
          nestedMjxCount: document.querySelectorAll("mjx-container mjx-container").length,
        };
      });

      console.log("After first edit:", JSON.stringify(afterFirstEdit));

      // On mobile, switch back to source editor to make the second edit
      if (isMobile) {
        // Click source toggle in bottom bar to turn it ON and show editor
        const sourceButton = page.locator(".sb-item").filter({ hasText: "source" });
        await sourceButton.click();
        await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
          timeout: 5000,
        });
        // Re-focus the editor
        const editor = page.locator("textarea.editor");
        await editor.click();
      }

      // Make another trivial edit to see if bug compounds
      await page.keyboard.type(" EDIT2");
      await page.waitForTimeout(3000);

      // On mobile, switch back to manuscript view to check the rendered output
      if (isMobile) {
        // Click source toggle in bottom bar to turn it OFF and show manuscript
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
          totalMjxCount: document.querySelectorAll("mjx-container").length,
          nestedMjxCount: document.querySelectorAll("mjx-container mjx-container").length,
        };
      });

      console.log("After second edit:", JSON.stringify(afterSecondEdit));

      // Raw LaTeX should never be visible in rendered manuscript
      expect(afterFirstEdit.hasRawInlineLatex).toBe(false);
      expect(afterFirstEdit.hasRawBlockLatex).toBe(false);
      expect(afterSecondEdit.hasRawInlineLatex).toBe(false);
      expect(afterSecondEdit.hasRawBlockLatex).toBe(false);

      // Title should appear exactly once (no content duplication)
      expect(afterFirstEdit.titleCount).toBe(1);
      expect(afterSecondEdit.titleCount).toBe(1);

      // There should only be ONE MathJax script tag
      expect(afterFirstEdit.scriptCount).toBe(1);

      // mjx-container counts in proper locations should stay the same
      expect(afterFirstEdit.inlineMjxCount).toBe(initialCounts.inline);
      expect(afterFirstEdit.blockMjxCount).toBe(initialCounts.block);
      expect(afterSecondEdit.inlineMjxCount).toBe(initialCounts.inline);
      expect(afterSecondEdit.blockMjxCount).toBe(initialCounts.block);

      // THE CRITICAL CHECK: There should NEVER be nested mjx-containers
      // This catches the bug where MathJax re-typesets already-typeset content
      expect(afterFirstEdit.nestedMjxCount).toBe(0);
      expect(afterSecondEdit.nestedMjxCount).toBe(0);
    } finally {
      // Clean up the test file
      await deleteTestFile(request, fileId);
    }
  });

  test("MathJax script tags should not multiply on re-renders", async ({ page, request }) => {
    // Create a fresh test file with math content
    const fileId = await createTestFileWithMath(request);

    try {
      // Navigate to the test file
      await page.goto(`/file/${fileId}`);

      // Wait for manuscript to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 5000,
      });

      // Wait for MathJax to load
      await page.waitForFunction(() => typeof window.MathJax !== "undefined", { timeout: 5000 });

      // Get initial script count
      const initialScriptCount = await page.evaluate(() => {
        return document.querySelectorAll('script[id="MathJax-script"]').length;
      });

      console.log(`Initial MathJax script count: ${initialScriptCount}`);

      // Open editor and make multiple edits
      const editorButton = page.locator(".sb-item").filter({ hasText: "source" });
      await editorButton.click();

      await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
        timeout: 5000,
      });

      const editor = page.locator("textarea.editor");
      await expect(editor).toBeVisible({ timeout: 5000 });

      // IMPORTANT: We edit the TITLE LINE (line 2), which is plain text and does NOT
      // contain any math. This ensures script tag multiplication is due to the
      // duplication bug, not because we're adding new math content.
      await editor.click();
      await page.keyboard.press("Control+Home");
      await page.keyboard.press("ArrowDown"); // Line 2 (title)
      await page.keyboard.press("End");

      // Make 3 edits to the title line
      for (let i = 0; i < 3; i++) {
        await page.keyboard.type(` edit${i}`);
        await page.waitForTimeout(3000);
      }

      // Get final script count
      const finalScriptCount = await page.evaluate(() => {
        return document.querySelectorAll('script[id="MathJax-script"]').length;
      });

      console.log(`Final MathJax script count after 3 edits: ${finalScriptCount}`);

      // THE BUG: Script count should remain 1, not increase with each edit.
      // This assertion will FAIL when the bug exists and PASS when fixed.
      expect(finalScriptCount).toBe(1);
    } finally {
      // Clean up the test file
      await deleteTestFile(request, fileId);
    }
  });
});
