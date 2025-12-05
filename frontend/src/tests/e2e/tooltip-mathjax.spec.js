import { test, expect } from "@playwright/test";
import { AuthHelpers } from "./utils/auth-helpers.js";

/**
 * Tooltip MathJax Rendering Test
 *
 * This test verifies that MathJax content inside tooltips is rendered correctly.
 * Tooltips are created when hovering over reference links (a.reference) and
 * display content cloned from the referenced element.
 *
 * The tooltip system calls MathJax.typeset() to render math in tooltip content,
 * which was causing a bug where it re-typeset the entire document instead of
 * just the tooltip content.
 */

// RSM source with a labeled math block and a reference to it
const RSM_SOURCE_WITH_MATH_REFERENCE = `:rsm:
# Tooltip Math Test

Here is an important equation:

:mathblock:
  :label: eqn-quadratic

  x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
::

The quadratic formula :ref:eqn-quadratic:: is used to solve quadratic equations.

::`;

test.describe("Tooltip MathJax Rendering @auth @desktop-only", () => {
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
      data: { title: "Tooltip Math Test", owner_id: testUserId, source },
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

  /**
   * Wait for MathJax to finish processing (no .MathJax_Processing elements)
   */
  async function waitForMathJaxDone(page) {
    await page.waitForFunction(() => !document.querySelector(".MathJax_Processing"), {
      timeout: 5000,
    });
  }

  /**
   * Wait for tooltip to contain rendered MathJax
   */
  async function waitForTooltipMath(page) {
    await page.waitForFunction(
      () => {
        const tooltip = document.querySelector(".tooltipster-base");
        if (!tooltip) return false;
        // Tooltip has MathJax rendered when mjx-container exists inside it
        return tooltip.querySelectorAll("mjx-container").length > 0;
      },
      { timeout: 5000 }
    );
  }

  test("tooltip should render MathJax content when hovering over reference", async ({
    page,
    request,
  }) => {
    const fileId = await createTestFile(request, RSM_SOURCE_WITH_MATH_REFERENCE);

    try {
      await page.goto(`/file/${fileId}`);

      // Wait for manuscript to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Wait for MathJax to render the main content
      await page.waitForFunction(() => document.querySelectorAll("mjx-container").length > 0, {
        timeout: 10000,
      });

      // Get initial MathJax container count
      const initialState = await page.evaluate(() => ({
        mjxCount: document.querySelectorAll("mjx-container").length,
        nestedMjxCount: document.querySelectorAll("mjx-container mjx-container").length,
        referenceLinks: document.querySelectorAll("a.reference").length,
      }));

      console.log("Initial state:", JSON.stringify(initialState));

      expect(initialState.referenceLinks).toBeGreaterThan(0);

      // Find the reference link and hover over it
      const referenceLink = page.locator("a.reference").first();
      await expect(referenceLink).toBeVisible({ timeout: 5000 });

      await referenceLink.hover();

      // Wait for tooltip to appear with rendered math
      await page.waitForSelector(".tooltipster-base", { timeout: 5000 });
      await waitForTooltipMath(page);

      // Check the tooltip contains rendered math
      const tooltipState = await page.evaluate(() => {
        const tooltip = document.querySelector(".tooltipster-base");
        if (!tooltip) return { error: "no tooltip found" };

        const tooltipMjx = tooltip.querySelectorAll("mjx-container").length;
        const tooltipText = tooltip.textContent || "";
        const hasRawLatex = tooltipText.includes("\\frac") || tooltipText.includes("\\sqrt");

        const docMjx = document.querySelectorAll("mjx-container").length;
        const nestedMjx = document.querySelectorAll("mjx-container mjx-container").length;

        return {
          tooltipVisible: true,
          tooltipMjxCount: tooltipMjx,
          hasRawLatexInTooltip: hasRawLatex,
          documentMjxCount: docMjx,
          nestedMjxCount: nestedMjx,
        };
      });

      console.log("Tooltip state:", JSON.stringify(tooltipState));

      expect(tooltipState.tooltipVisible).toBe(true);
      expect(tooltipState.tooltipMjxCount).toBeGreaterThan(0);
      expect(tooltipState.hasRawLatexInTooltip).toBe(false);

      // No nested mjx-containers (the duplication bug)
      expect(tooltipState.nestedMjxCount).toBe(0);

      // Move mouse away to close tooltip
      await page.mouse.move(0, 0);

      // Wait for tooltip to close
      await page.waitForFunction(() => !document.querySelector(".tooltipster-base"), {
        timeout: 3000,
      });

      // Final check
      const finalState = await page.evaluate(() => ({
        mjxCount: document.querySelectorAll("mjx-container").length,
        nestedMjxCount: document.querySelectorAll("mjx-container mjx-container").length,
      }));

      console.log("Final state:", JSON.stringify(finalState));
      expect(finalState.nestedMjxCount).toBe(0);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });

  test("showing tooltip should not duplicate MathJax in main document", async ({
    page,
    request,
  }) => {
    const fileId = await createTestFile(request, RSM_SOURCE_WITH_MATH_REFERENCE);

    try {
      await page.goto(`/file/${fileId}`);

      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Wait for MathJax to render
      await page.waitForFunction(() => document.querySelectorAll("mjx-container").length > 0, {
        timeout: 10000,
      });

      // Wait for MathJax to finish processing
      await waitForMathJaxDone(page);

      // Get the count of mjx-containers in the MAIN manuscript
      const beforeTooltip = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        return {
          manuscriptMjx: manuscript?.querySelectorAll("mjx-container").length || 0,
          documentMjx: document.querySelectorAll("mjx-container").length,
        };
      });

      console.log("Before tooltip:", JSON.stringify(beforeTooltip));

      // Hover over reference to trigger tooltip
      const referenceLink = page.locator("a.reference").first();
      await referenceLink.hover();

      // Wait for tooltip with rendered math
      await page.waitForSelector(".tooltipster-base", { timeout: 5000 });
      await waitForTooltipMath(page);

      // Check manuscript mjx count hasn't changed
      const afterTooltip = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        const tooltip = document.querySelector(".tooltipster-base");
        return {
          manuscriptMjx: manuscript?.querySelectorAll("mjx-container").length || 0,
          tooltipMjx: tooltip?.querySelectorAll("mjx-container").length || 0,
          documentMjx: document.querySelectorAll("mjx-container").length,
          nestedMjx: document.querySelectorAll("mjx-container mjx-container").length,
        };
      });

      console.log("After tooltip:", JSON.stringify(afterTooltip));

      // Manuscript mjx count should NOT increase
      expect(afterTooltip.manuscriptMjx).toBe(beforeTooltip.manuscriptMjx);

      // No nested containers
      expect(afterTooltip.nestedMjx).toBe(0);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });
});
