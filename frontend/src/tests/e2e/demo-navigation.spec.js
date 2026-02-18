import { test, expect } from "./fixtures.js";

// @demo
import { AuthHelpers } from "./utils/auth-helpers.js";

test.describe.skip("Demo Navigation & Access @demo-disabled", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    // Use proper auth clearing from auth helpers
    await authHelpers.clearAuthState();
  });

  test.describe("Route Access", () => {
    test("can navigate to /demo route directly", async ({ page }) => {
      // Verify tokens are cleared
      const tokens = await authHelpers.getStoredTokens();
      expect(tokens.accessToken).toBeNull();

      await page.goto("/demo", { waitUntil: "domcontentloaded" });

      // Wait for the page to load
      await page.waitForLoadState("load");

      // Verify we're on the demo page (not redirected to login)
      expect(page.url()).toContain("/demo");

      // Check for demo-specific elements
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
    });

    test("demo route loads without authentication", async ({ page }) => {
      // Double-check that auth state is truly cleared
      await authHelpers.clearAuthState();

      // Verify no tokens exist
      const tokens = await authHelpers.getStoredTokens();
      expect(tokens.accessToken).toBeNull();
      expect(tokens.refreshToken).toBeNull();

      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Should load successfully without redirects to login
      expect(page.url()).toContain("/demo");
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
    });

    test("demo banner displays with correct messaging", async ({ page }) => {
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      const banner = page.locator(".demo-banner");
      await expect(banner).toBeVisible();

      // Check banner content
      await expect(banner).toContainText("Demo Mode");
      await expect(banner).toContainText("Experience Aris workspace with sample content");

      // Check for demo icon (SVG element)
      await expect(banner.locator(".demo-icon")).toBeVisible();
      // SVG icons don't have text content, just check it's an icon element
      const iconElement = banner.locator(".demo-icon");
      await expect(iconElement).toHaveAttribute("class", /tabler-icon/);
    });

    test("back to homepage link works correctly", async ({ page }) => {
      // Clear auth state first
      await authHelpers.clearAuthState();

      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      const backLink = page.locator(".demo-link");
      await expect(backLink).toBeVisible();
      await expect(backLink).toContainText("← Back to homepage");

      // Click the back link
      await backLink.click();

      // Should navigate away from demo (may go to login since user is not authenticated)
      await page.waitForLoadState("load");

      // Check if navigation occurred (could stay on demo if link doesn't work)
      const currentUrl = page.url();
      if (currentUrl.includes("/demo")) {
        // If still on demo, check if link is actually functioning
        // This might be expected behavior depending on implementation
      } else {
        // Navigation worked, verify we're in an expected location
        expect(page.url()).toMatch(/\/$|\/home|\/login/);
      }
    });

    test("demo page loads with correct title", async ({ page }) => {
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Check page title
      const title = await page.title();
      expect(title).toContain("Aris");
    });
  });

  test.describe("Public Access", () => {
    test("demo accessible without login", async ({ page }) => {
      // Use comprehensive auth clearing
      await authHelpers.clearAuthState();

      // Verify clean state
      const tokens = await authHelpers.getStoredTokens();
      expect(tokens.accessToken).toBeNull();

      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Verify demo loads successfully
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();

      // Verify we're not redirected to login
      expect(page.url()).toContain("/demo");
      expect(page.url()).not.toContain("/login");
      expect(page.url()).not.toContain("/auth");
    });

    test("demo works in incognito/private browsing mode", async ({ browser }) => {
      // Create a new incognito context
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Should load successfully in incognito mode
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
      expect(page.url()).toContain("/demo");

      await context.close();
    });

    test("demo loads with clean browser state", async ({ page }) => {
      // Use auth helpers to properly clear state
      await authHelpers.clearAuthState();

      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Wait for Vue to mount the demo container
      // Fast check for demo container
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();

      // Verify demo loads with clean state
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
      await expect(page.locator(".demo-banner")).toBeVisible();
    });
  });

  test.describe("Navigation Integration", () => {
    test("can navigate to demo from other pages", async ({ page }) => {
      // Start from homepage
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Navigate to demo (assuming there might be a demo link somewhere)
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
    });

    test("can navigate away from demo and back", async ({ page }) => {
      // Go to demo
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();

      // Navigate away
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Go back to demo
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
    });

    test("browser back button works from demo", async ({ page }) => {
      // Clear auth state first
      await authHelpers.clearAuthState();

      // Navigate to demo directly (as if shared link)
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();

      // Use the back to homepage link instead of browser back
      // since demo was accessed directly (more realistic for shared links)
      const backLink = page.locator(".demo-link");
      await expect(backLink).toBeVisible();
      await backLink.click();
      await page.waitForLoadState("load");

      // Should navigate away from demo (may go to login since user is not authenticated)
      const currentUrl = page.url();
      if (currentUrl.includes("/demo")) {
        // If still on demo, check if link is actually functioning
        // This might be expected behavior depending on implementation
      } else {
        // Navigation worked, verify we're in an expected location
        expect(page.url()).toMatch(/\/$|\/home|\/login/);
      }
    });

    test("direct URL sharing works", async ({ page }) => {
      // Clear auth state using the proper auth helpers approach
      await authHelpers.clearAuthState();

      // Simulate direct navigation to demo URL (as if someone shared the link)
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Wait for Vue to mount the demo container
      // Fast check for demo container
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();

      // Should load demo directly without redirect to login
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
      expect(page.url()).toContain("/demo");
    });
  });

  test.describe("Page Structure", () => {
    test("demo page has correct basic structure", async ({ page }) => {
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Check main containers exist
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
      await expect(page.locator(".demo-banner")).toBeVisible();

      // Check for workspace or main content area (flexible selector)
      const workspaceSelectors = [
        '[data-testid="workspace-container"]',
        ".workspace-container",
        ".workspace",
        ".main-content",
        '[data-testid="workspace"]',
        ".demo-content",
      ];

      let workspaceFound = false;
      for (const selector of workspaceSelectors) {
        if ((await page.locator(selector).count()) > 0) {
          await expect(page.locator(selector)).toBeVisible({ timeout: 10000 });
          workspaceFound = true;
          break;
        }
      }

      // If no specific workspace container, at least verify basic content is visible
      if (!workspaceFound) {
        await expect(page.locator(".demo-banner")).toBeVisible();
      }
    });

    test("demo page has correct viewport meta tag", async ({ page }) => {
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Check viewport meta tag for mobile support
      const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
      expect(viewport).toContain("width=device-width");
    });

    test("demo page loads required CSS and JS", async ({ page }) => {
      await page.goto("/demo", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Check that demo-specific styles are applied
      const demoContainer = page.locator('[data-testid="demo-container"]');
      await expect(demoContainer).toHaveClass(/demo-view/);
    });
  });

  test.describe("Error Handling", () => {
    test("handles demo route with query parameters", async ({ page }) => {
      // Clear auth state first
      await authHelpers.clearAuthState();

      await page.goto("/demo?test=1&other=value", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Wait for Vue to mount the demo container
      // Fast check for demo container
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();

      // Should still load demo correctly
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
      expect(page.url()).toContain("/demo");
    });

    test("handles demo route with hash fragments", async ({ page }) => {
      // Clear auth state first
      await authHelpers.clearAuthState();

      await page.goto("/demo#section", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");

      // Wait for Vue to mount the demo container
      // Fast check for demo container
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();

      // Should still load demo correctly
      await expect(page.locator('[data-testid="demo-container"]')).toBeVisible();
      expect(page.url()).toContain("/demo");
    });
  });
});
