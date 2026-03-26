/**
 * E2E test: minimap annotation marks are visible at narrow viewports.
 *
 * Regression test for clipping bug where 32px icon marks overflowed
 * the 20px minimap strip and were clipped by overflow-x:hidden.
 */
import { test, expect } from "@playwright/test";

test.describe("Minimap annotation marks", () => {
  test("annotation marks are visible and not clipped at 1400px viewport", async ({ page }) => {
    // This test requires a running dev server with annotations on file 327.
    // Skip if no server is available.
    try {
      await page.goto("http://localhost:5175", { timeout: 5000 });
    } catch {
      test.skip();
      return;
    }

    await page.setViewportSize({ width: 1400, height: 900 });

    // Inject session
    const session = require("/Users/leo.torres/.studio/session.json");
    await page.evaluate((s) => {
      localStorage.setItem("accessToken", s.access_token);
      localStorage.setItem("refreshToken", s.refresh_token);
      localStorage.setItem("user", JSON.stringify(s.user));
    }, session);

    await page.reload({ waitUntil: "networkidle" });
    await page.goto("http://localhost:5175/file/327", { waitUntil: "networkidle" });

    // Wait for manuscript
    await expect(page.locator(".hr")).toHaveCount(1, { timeout: 60000 }).catch(() => {});
    await page.waitForSelector(".hr", { timeout: 60000 });
    await page.waitForTimeout(15000);

    // Check that annotation marks exist and fit within the container
    const result = await page.evaluate(() => {
      const marks = document.querySelectorAll(".mm-annotation");
      const container = document.querySelector(".inner.right");
      if (!marks.length || !container) return { marks: 0, container: false };

      const contRect = container.getBoundingClientRect();
      let clippedCount = 0;
      for (const mark of marks) {
        if (mark.getBoundingClientRect().right > contRect.right) clippedCount++;
      }

      return {
        marks: marks.length,
        container: true,
        clipped: clippedCount,
        firstMarkWidth: Math.round(marks[0].getBoundingClientRect().width),
      };
    });

    expect(result.marks).toBeGreaterThan(0);
    expect(result.clipped).toBe(0);
    expect(result.firstMarkWidth).toBeLessThanOrEqual(20);
  });
});
