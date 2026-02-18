/**
 * @file Minimal E2E tests for RSM section on current landing page
 */

import { test, expect } from "./fixtures/api-intercept.js";

test.describe.skip("RSM Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/#demo"]');
  });

  test("RSM section loads with current structure @core", async ({ page }) => {
    // Check section is visible
    await expect(page.locator("#demo")).toBeInViewport();
    await expect(page.locator("text=Introducing Readable Science Markup (RSM)")).toBeVisible();

    // Check current tab buttons exist
    await expect(page.locator('[data-testid="tab-academic"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-interactive"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-academic"]')).toContainText(
      "Academic-Grade Output"
    );

    // Check view controls exist
    await expect(page.locator('[data-testid="view-markup"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-output"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-both"]')).toBeVisible();
  });

  test("tab switching works with current examples @core", async ({ page }) => {
    // Should start with academic tab active
    await expect(page.locator('[data-testid="tab-academic"]')).toHaveClass(/active/);

    // Switch to interactive tab
    await page.click('[data-testid="tab-interactive"]');
    await expect(page.locator('[data-testid="tab-interactive"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="tab-academic"]')).not.toHaveClass(/active/);
  });

  test("live API integration renders content @core", async ({ page }) => {
    // Mock render API
    await page.route("**/render", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify("<div class='test-content'><h1>Live Rendered Content</h1></div>"),
      });
    });

    await page.reload();
    await page.click('a[href="#demo"]');

    // Wait for API calls and content rendering
    await page.waitForTimeout(1000);

    // Should show rendered content
    await expect(page.locator(".output-content")).toContainText("Live Rendered Content");
  });

  test("view mode controls work @core", async ({ page }) => {
    // Test markup-only view
    await page.click('[data-testid="view-markup"]');
    await expect(page.locator(".markup-panel")).toBeVisible();
    await expect(page.locator(".output-panel")).not.toBeVisible();

    // Test output-only view
    await page.click('[data-testid="view-output"]');
    await expect(page.locator(".markup-panel")).not.toBeVisible();
    await expect(page.locator(".output-panel")).toBeVisible();

    // Test both view
    await page.click('[data-testid="view-both"]');
    await expect(page.locator(".markup-panel")).toBeVisible();
    await expect(page.locator(".output-panel")).toBeVisible();
  });
});
