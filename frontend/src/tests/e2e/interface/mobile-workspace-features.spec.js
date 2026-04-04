import { test, expect, devices } from "../fixtures.js";
import { MobileHelpers } from "../utils/mobile-helpers.js";
import { AuthHelpers } from "../utils/auth-helpers.js";

test.describe("Mobile Workspace — hidden desktop-only features @auth @mobile-only", () => {
  let mobileHelpers;

  const mobileDevice = { name: "iPhone 12", device: devices["iPhone 12"] };

  /**
   * Navigate to a workspace by clicking the first file on the home page.
   * File items use router.push('/file/:id'), not <a> tags.
   */
  async function navigateToWorkspace(page, helpers) {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await helpers.waitForMobileRendering();

    const fileItem = page.locator('[data-testid^="file-item-"]').first();
    await expect(fileItem).toBeVisible({ timeout: 5000 });
    await fileItem.click();
    await page.waitForURL(/\/file\//, { timeout: 5000 });
    await page.waitForLoadState("domcontentloaded");
    await helpers.waitForMobileRendering();
  }

  test("source editor toggle should not appear in mobile bottom bar", async ({ browser }) => {
    const context = await browser.newContext({
      ...mobileDevice.device,
      isMobile: undefined,
    });
    const page = await context.newPage();
    mobileHelpers = new MobileHelpers(page);
    const auth = new AuthHelpers(page);
    await auth.fastAuth();

    await navigateToWorkspace(page, mobileHelpers);

    // Source editor toggle (label "source") should NOT be in mobile bottom bar
    const sourceButton = page.locator('.sb-menu.mobile .sb-item-label:text("source")');
    await expect(sourceButton).not.toBeVisible();

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

    await navigateToWorkspace(page, mobileHelpers);

    // Open the overflow menu (workspace sidebar, not home page hamburger)
    const menuButton = page.locator('[data-testid="mobile-menu-button"]');
    await expect(menuButton).toBeVisible({ timeout: 5000 });
    await menuButton.click();

    const menu = page.locator('[data-testid="context-menu"]').first();
    await expect(menu).toBeVisible({ timeout: 5000 });

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

    await context.close();
  });
});
