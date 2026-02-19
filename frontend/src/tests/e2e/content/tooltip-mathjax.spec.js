// @auth @auth-content
import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";
import { getBackendURL } from "../utils/test-config.js";

/**
 * Tooltip Math Rendering Test
 *
 * This test verifies that math content inside tooltips is rendered correctly.
 * Tooltips are created when hovering over reference links (a.reference) and
 * display content cloned from the referenced element.
 *
 * RSM uses Temml as the primary renderer (synchronous, native MathML).
 * The tooltip system calls onrender() on the tooltip content, which runs
 * typesetMath() to render math — this should affect only the tooltip, not
 * the main document.
 */

// RSM source with a labeled math block and a reference to it
const RSM_SOURCE_WITH_MATH_REFERENCE = `# Tooltip Math Test

Here is an important equation:

:mathblock:{
  :label: eqn-quadratic
}
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
::

The quadratic formula :ref:eqn-quadratic:: is used to solve quadratic equations.
`;

test.describe("Tooltip Math Rendering @auth @desktop-only", () => {
  let authHelpers;
  let baseURL;
  let accessToken;
  let testUserId;

  test.beforeEach(async ({ page }) => {
    baseURL = getBackendURL();
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
    await page.waitForLoadState("networkidle").catch(() => {});
    accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));
    const userData = await page.evaluate(() => JSON.parse(localStorage.getItem("user")));
    testUserId = userData.id;
  });

  test.afterEach(async ({ page }) => {
    await page.waitForLoadState("networkidle").catch(() => {});
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
   * Wait for tooltip to contain rendered math (native MathML from Temml)
   */
  async function waitForTooltipMath(page) {
    await page.waitForFunction(
      () => {
        const tooltip = document.querySelector(".tooltipster-base");
        if (!tooltip) return false;
        return tooltip.querySelectorAll("math").length > 0;
      },
      { timeout: 5000 }
    );
  }

  test("tooltip should render math content when hovering over reference", async ({
    page,
    request,
  }) => {
    const fileId = await createTestFile(request, RSM_SOURCE_WITH_MATH_REFERENCE);

    try {
      await page.goto(`/file/${fileId}`);

      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Wait for Temml to render math in the main content
      await page.waitForFunction(() => document.querySelectorAll("math").length > 0, {
        timeout: 10000,
      });

      const initialState = await page.evaluate(() => ({
        mathCount: document.querySelectorAll("math").length,
        nestedMathCount: document.querySelectorAll("math math").length,
        referenceLinks: document.querySelectorAll("a.reference").length,
      }));

      expect(initialState.referenceLinks).toBeGreaterThan(0);

      const referenceLink = page.locator("a.reference").first();
      await expect(referenceLink).toBeVisible({ timeout: 5000 });

      await referenceLink.hover();

      await page.waitForSelector(".tooltipster-base", { timeout: 5000 });
      await waitForTooltipMath(page);

      const tooltipState = await page.evaluate(() => {
        const tooltip = document.querySelector(".tooltipster-base");
        if (!tooltip) return { error: "no tooltip found" };

        const tooltipMath = tooltip.querySelectorAll("math").length;
        const tooltipText = tooltip.textContent || "";
        const hasRawLatex = tooltipText.includes("\\frac") || tooltipText.includes("\\sqrt");

        const docMath = document.querySelectorAll("math").length;
        const nestedMath = document.querySelectorAll("math math").length;

        return {
          tooltipVisible: true,
          tooltipMathCount: tooltipMath,
          hasRawLatexInTooltip: hasRawLatex,
          documentMathCount: docMath,
          nestedMathCount: nestedMath,
        };
      });

      expect(tooltipState.tooltipVisible).toBe(true);
      expect(tooltipState.tooltipMathCount).toBeGreaterThan(0);
      expect(tooltipState.hasRawLatexInTooltip).toBe(false);

      // No nested math elements (the duplication bug symptom)
      expect(tooltipState.nestedMathCount).toBe(0);

      await page.mouse.move(0, 0);

      await page.waitForFunction(() => !document.querySelector(".tooltipster-base"), {
        timeout: 3000,
      });

      const finalState = await page.evaluate(() => ({
        mathCount: document.querySelectorAll("math").length,
        nestedMathCount: document.querySelectorAll("math math").length,
      }));

      expect(finalState.nestedMathCount).toBe(0);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });

  test("showing tooltip should not duplicate math in main document", async ({ page, request }) => {
    const fileId = await createTestFile(request, RSM_SOURCE_WITH_MATH_REFERENCE);

    try {
      await page.goto(`/file/${fileId}`);

      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      await page.waitForFunction(() => document.querySelectorAll("math").length > 0, {
        timeout: 10000,
      });

      const beforeTooltip = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        return {
          manuscriptMath: manuscript?.querySelectorAll("math").length || 0,
          documentMath: document.querySelectorAll("math").length,
        };
      });

      const referenceLink = page.locator("a.reference").first();
      await referenceLink.hover();

      await page.waitForSelector(".tooltipster-base", { timeout: 5000 });
      await waitForTooltipMath(page);

      const afterTooltip = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        const tooltip = document.querySelector(".tooltipster-base");
        return {
          manuscriptMath: manuscript?.querySelectorAll("math").length || 0,
          tooltipMath: tooltip?.querySelectorAll("math").length || 0,
          documentMath: document.querySelectorAll("math").length,
          nestedMath: document.querySelectorAll("math math").length,
        };
      });

      // Manuscript math count should NOT increase
      expect(afterTooltip.manuscriptMath).toBe(beforeTooltip.manuscriptMath);

      // No nested math elements
      expect(afterTooltip.nestedMath).toBe(0);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });
});
