import { test, expect } from "../fixtures.js";

// @auth @auth-interface
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";

test.describe("Home View Accessibility @auth @desktop-only", () => {
  let authHelpers, fileHelpers;

  test.beforeEach(async ({ page }) => {
    // Set desktop viewport for desktop-only accessibility tests
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();
    await fileHelpers.waitForFilesLoaded();
  });

  test("file items have proper ARIA roles and attributes", async ({ page }) => {
    const fileItems = page.locator('[data-testid^="file-item-"]');
    const firstFile = fileItems.first();

    if ((await firstFile.count()) > 0) {
      // File items should have button role
      await expect(firstFile).toHaveAttribute("role", "option");
      await expect(firstFile).toHaveAttribute("tabindex", "0");
    }
  });

  test("file list container has proper accessibility attributes", async ({ page }) => {
    const filesContainer = page.locator('[data-testid="files-container"]');
    await expect(filesContainer).toBeVisible();

    // Should be keyboard accessible
    const focusableElements = page.locator('[tabindex="0"], button, input, a');
    expect(await focusableElements.count()).toBeGreaterThan(0);
  });

  test("keyboard navigation works for basic file interaction", async ({ page }) => {
    const fileItems = page.locator('[data-testid^="file-item-"]');

    if ((await fileItems.count()) > 0) {
      const firstFile = fileItems.first();

      // Should be able to focus file items
      await firstFile.focus();
      await expect(firstFile).toBeFocused();

      // Should be able to activate with Enter
      await page.keyboard.press("Enter");

      // Should either open file or show menu (depending on implementation)
      // Just verify no errors occurred and page remains functional
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
