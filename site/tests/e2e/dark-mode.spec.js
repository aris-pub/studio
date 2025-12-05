/**
 * @file E2E tests for dark mode functionality
 */

import { test, expect } from "@playwright/test";

test.describe("Dark Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("dark mode toggle works @core", async ({ page }) => {
    // Check if we're on mobile and need to open hamburger menu first
    const isMobile = page.viewportSize()?.width < 768;

    let toggle;
    if (isMobile) {
      // On mobile, open hamburger menu first
      const hamburger = page.locator(".nav-hamburger");
      await expect(hamburger).toBeVisible();
      await hamburger.click();

      // Wait for mobile menu to open and target the toggle inside it specifically
      const mobileMenu = page.locator(".nav-mobile.nav-mobile-open");
      await expect(mobileMenu).toBeVisible();
      toggle = mobileMenu.locator('[data-testid="dark-mode-toggle"]');
      await expect(toggle).toBeVisible();
    } else {
      // On desktop, toggle should be directly visible in nav-actions
      toggle = page.locator('.nav-actions [data-testid="dark-mode-toggle"]');
    }

    await expect(toggle).toBeVisible();

    // 2. Click toggle and verify body class changes
    await toggle.click();
    await expect(page.locator("body")).toHaveClass(/dark-theme/);

    // 3. Verify persistence - refresh and check state maintained
    await page.reload();
    await expect(page.locator("body")).toHaveClass(/dark-theme/);

    // 4. Toggle back to light mode to ensure it works both ways
    let toggleAfterReload;
    if (isMobile) {
      // On mobile, open hamburger menu again after reload
      const hamburgerAfterReload = page.locator(".nav-hamburger");
      await hamburgerAfterReload.click();
      const mobileMenuAfterReload = page.locator(".nav-mobile.nav-mobile-open");
      await expect(mobileMenuAfterReload).toBeVisible();
      toggleAfterReload = mobileMenuAfterReload.locator('[data-testid="dark-mode-toggle"]');
      await expect(toggleAfterReload).toBeVisible();
    } else {
      toggleAfterReload = page.locator('.nav-actions [data-testid="dark-mode-toggle"]');
    }

    await toggleAfterReload.click();
    await expect(page.locator("body")).not.toHaveClass(/dark-theme/);
  });
});
