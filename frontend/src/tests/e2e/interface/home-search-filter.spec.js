import { test, expect } from "@playwright/test";

// @auth @auth-interface
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";

test.describe("Home View Search & Filter @auth @desktop-only", () => {
  let authHelpers, fileHelpers;

  test.beforeEach(async ({ page }) => {
    // Set desktop viewport for desktop-only keyboard navigation tests
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();
    await fileHelpers.waitForFilesLoaded();
  });

  test("search input is accessible and functional", async ({ page }) => {
    // Check if search input exists
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"]').first();

    if ((await searchInput.count()) > 0) {
      await expect(searchInput).toBeVisible();

      // Should be able to type in search
      await searchInput.fill("test");
      expect(await searchInput.inputValue()).toBe("test");

      // Clear search
      await searchInput.clear();
      expect(await searchInput.inputValue()).toBe("");
    }
  });

  test("search keyboard shortcut opens search", async ({ page }) => {
    // Test search shortcut
    await page.keyboard.press("/");

    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"]').first();
    if ((await searchInput.count()) > 0) {
      await expect(searchInput).toBeFocused();

      // Escape should exit search
      await page.keyboard.press("Escape");
    }
  });
});
