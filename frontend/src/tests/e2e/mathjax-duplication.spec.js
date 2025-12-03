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

// RSM source with block math - the math content is FIXED and edits are made
// to the TITLE LINE only, ensuring any mjx-container count increase is due
// to the duplication bug, not new math being added.
const RSM_SOURCE_WITH_MATH = `:rsm:
# Test Document for MathJax Bug

This document contains block math to test the MathJax duplication bug.

:math:
E = mc^2
::

And here is another equation\\:

:math:
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
::

::`;

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
    // Create a fresh test file with math content
    const fileId = await createTestFileWithMath(request);

    try {
      // Navigate to the test file
      await page.goto(`/file/${fileId}`);

      // Wait for manuscript to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 5000,
      });

      // Wait for MathJax to finish rendering (check for top-level containers only)
      await page.waitForFunction(
        () => {
          const containers = document.querySelectorAll("span.math > mjx-container");
          return containers.length > 0;
        },
        { timeout: 5000 }
      );

      // Wait for rendering to stabilize (no new containers for 500ms)
      let lastCount = 0;
      let stableCount = 0;
      while (stableCount < 3) {
        await page.waitForTimeout(500);
        const currentCount = await page.evaluate(
          () => document.querySelectorAll("span.math > mjx-container").length
        );
        if (currentCount === lastCount) {
          stableCount++;
        } else {
          stableCount = 0;
          lastCount = currentCount;
        }
      }

      // Count only TOP-LEVEL mjx-containers (direct children of span.math)
      // MathJax 3 creates nested containers inside mjx-assistive-mml for accessibility,
      // so we can't just count all mjx-container elements.
      const initialCount = await page.evaluate(() => {
        return document.querySelectorAll("span.math > mjx-container").length;
      });

      console.log(`Initial MathJax container count: ${initialCount}`);

      // EXPECTED: 2 containers (one per math block)
      expect(initialCount).toBe(2);

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

      // Get count after first edit (top-level containers only)
      const afterFirstEditCount = await page.evaluate(() => {
        return document.querySelectorAll("span.math > mjx-container").length;
      });

      console.log(`MathJax container count after first edit: ${afterFirstEditCount}`);

      // Make another trivial edit (still on the title line, no new math)
      await page.keyboard.type(" EDIT2");
      await page.waitForTimeout(3000);

      await page.waitForFunction(() => !document.querySelector(".MathJax_Processing"), {
        timeout: 5000,
      });

      // Get count after second edit (top-level containers only)
      const afterSecondEditCount = await page.evaluate(() => {
        return document.querySelectorAll("span.math > mjx-container").length;
      });

      console.log(`MathJax container count after second edit: ${afterSecondEditCount}`);

      // Check for MathJax script tag duplication
      const scriptCount = await page.evaluate(() => {
        return document.querySelectorAll('script[id="MathJax-script"]').length;
      });

      console.log(`MathJax script tag count: ${scriptCount}`);

      // THE BUG: After edits, MathJax containers should NOT increase.
      // This assertion will FAIL when the bug exists and PASS when fixed.
      expect(afterFirstEditCount).toBe(initialCount);
      expect(afterSecondEditCount).toBe(initialCount);

      // There should only be ONE MathJax script tag
      expect(scriptCount).toBe(1);
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
