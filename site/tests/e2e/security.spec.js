/**
 * @file E2E tests for security features - HTTPS redirect and headers
 */

import { test, expect } from "@playwright/test";

test.describe("Security", () => {
  test("HTTP redirects to HTTPS on production domain @core", async ({ page }) => {
    // Skip this test in local development (only test on deployed site)
    await page.goto("/");
    const isLocalhost = page.url().includes("localhost");
    test.skip(isLocalhost, "HTTPS redirect only applies to production domain");

    // Get the current domain from page URL and construct HTTP version
    const httpsUrl = page.url();
    const httpUrl = httpsUrl.replace("https://", "http://");

    // Test HTTP to HTTPS redirect using fetch with manual redirect handling
    const response = await page.evaluate(async (url) => {
      const resp = await fetch(url, { redirect: "manual" });
      return {
        status: resp.status,
        location: resp.headers.get("location"),
      };
    }, httpUrl);

    // Netlify should redirect HTTP to HTTPS with 301
    expect(response.status).toBe(301);
    expect(response.location).toMatch(/^https:/);
  });

  test("security headers are present @core", async ({ page }) => {
    await page.goto("/");

    // Get response headers using page.request
    const response = await page.request.get("/");
    const headers = response.headers();

    // Check for specific security headers we implement
    expect(headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("404 page renders correctly @core", async ({ page }) => {
    // Navigate to non-existent page
    const response = await page.goto("/non-existent-page", { waitUntil: "domcontentloaded" });

    // Should return 404 status
    expect(response.status()).toBe(404);

    // Should show our custom 404 page
    await expect(page.locator(".error-page")).toBeVisible();
    await expect(page.locator(".error-code")).toContainText("404");
    await expect(page.locator(".error-title")).toContainText("Page Not Found");

    // Back button should work
    const backButton = page.locator(".back-button");
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should navigate back to home
    await expect(page).toHaveURL("/");
  });

  test("404 page supports dark mode @core", async ({ page }) => {
    // Enable dark mode first
    await page.goto("/");

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

    await toggle.click();
    await expect(page.locator("body")).toHaveClass(/dark-theme/);

    // Navigate to 404 page
    await page.goto("/non-existent-page");

    // Should maintain dark mode on 404 page
    await expect(page.locator("body")).toHaveClass(/dark-theme/);
    await expect(page.locator(".error-page")).toBeVisible();
  });
});
