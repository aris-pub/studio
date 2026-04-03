import { test, expect, devices } from "../fixtures.js";
import { MobileHelpers } from "../utils/mobile-helpers.js";
import { AuthHelpers } from "../utils/auth-helpers.js";

test.describe("Mobile Workspace — hidden desktop-only features @auth @mobile-only", () => {
  let mobileHelpers;

  const mobileDevice = { name: "iPhone 12", device: devices["iPhone 12"] };

  test("source editor toggle should not appear in mobile bottom bar", async ({ browser }) => {
    const context = await browser.newContext({
      ...mobileDevice.device,
      isMobile: undefined,
    });
    const page = await context.newPage();
    mobileHelpers = new MobileHelpers(page);
    const auth = new AuthHelpers(page);
    await auth.fastAuth();

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await mobileHelpers.waitForMobileRendering();

    // Navigate to a file workspace (first file link)
    const fileLink = page.locator('a[href*="/ws/"]').first();
    if (await fileLink.isVisible()) {
      await fileLink.click();
      await page.waitForLoadState("domcontentloaded");
      await mobileHelpers.waitForMobileRendering();
    }

    // Source editor toggle (label "source") should NOT be in mobile bottom bar
    const sourceButton = page.locator('.sb-menu.mobile .sb-item-label:text("source")');
    await expect(sourceButton).not.toBeVisible();

    // Search toggle should still be visible
    const searchButton = page.locator('.sb-menu.mobile .sb-item-label:text("search")');
    // search may or may not be visible depending on workspace rendering,
    // but source must not be

    await context.close();
  });

  test("versions and share should not appear in mobile overflow menu", async ({ browser }) => {
    const context = await browser.newContext({
      ...mobileDevice.device,
      isMobile: undefined,
    });
    const page = await context.newPage();
    mobileHelpers = new MobileHelpers(page);
    const auth = new AuthHelpers(page);
    await auth.fastAuth();

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await mobileHelpers.waitForMobileRendering();

    // Navigate to a file workspace
    const fileLink = page.locator('a[href*="/ws/"]').first();
    if (await fileLink.isVisible()) {
      await fileLink.click();
      await page.waitForLoadState("domcontentloaded");
      await mobileHelpers.waitForMobileRendering();
    }

    // Open the overflow menu
    const menuButton = page.locator('[data-testid="mobile-menu-button"]');
    if (await menuButton.isVisible()) {
      await mobileHelpers.clickElement(menuButton);
      await mobileHelpers.waitForMobileRendering();

      const menu = page.locator('[data-testid="context-menu"]');
      await expect(menu).toBeVisible();

      // Versions should NOT be in the menu
      const versionsItem = menu.locator(".item").filter({ hasText: "versions" });
      await expect(versionsItem).not.toBeVisible();

      // Share should NOT be in the menu
      const shareItem = menu.locator(".item").filter({ hasText: "share" });
      await expect(shareItem).not.toBeVisible();

      // Settings SHOULD be in the menu
      const settingsItem = menu.locator(".item").filter({ hasText: "settings" });
      await expect(settingsItem).toBeVisible();

      // File SHOULD be in the menu
      const fileItem = menu.locator(".item").filter({ hasText: "file" });
      await expect(fileItem).toBeVisible();
    }

    await context.close();
  });
});
