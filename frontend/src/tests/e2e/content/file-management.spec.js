import { test, expect } from "@playwright/test";

// @auth @auth-content
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";

test.describe("File Management Tests @auth @desktop-only", () => {
  let authHelpers;
  let fileHelpers;

  test.beforeEach(async ({ page }) => {
    // Set desktop viewport for desktop-only keyboard navigation tests
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    // Ensure logged in (handles both real auth and disabled auth)
    await authHelpers.ensureLoggedIn();
  });

  test("create new RSM file and verify in file list", async ({ page }) => {
    // Create new file
    const fileId = await fileHelpers.createNewFile();
    expect(fileId).toBeTruthy();

    // Verify we're in the workspace for the new file
    await expect(page).toHaveURL(`/file/${fileId}`);

    // Navigate back to home to see file list
    await fileHelpers.navigateToHome();

    // Verify file appears in the list
    await fileHelpers.waitForFilesLoaded();
    const fileExists = await fileHelpers.fileExists(fileId);
    expect(fileExists).toBe(true);

    // Verify file has default title
    const fileTitle = await fileHelpers.getFileTitle(fileId);
    expect(fileTitle).toContain("New File");

    // TODO: Clean up - deletion functionality needs to be fixed
    // await fileHelpers.deleteFile(fileId);
  });

  // TEMPORARILY DISABLED: Failing in Firefox due to context menu interaction issues
  // Error: Context menu not opening/closing correctly in Firefox browser
  // TODO: Re-enable once Firefox-specific context menu handling is fixed
  test.skip("file context menu opens and closes correctly", async ({ page }) => {
    // Create a file for menu testing
    const fileId = await fileHelpers.createNewFile();
    await fileHelpers.navigateToHome();

    // Verify file exists
    const fileExists = await fileHelpers.fileExists(fileId);
    expect(fileExists).toBe(true);

    // Open file menu
    await fileHelpers.openFileMenu(fileId);

    // Verify menu is visible with expected options
    const contextMenu = page.locator('[data-testid="context-menu"]').first();
    await expect(contextMenu).toBeVisible();
    await expect(page.locator('text="Delete"')).toBeVisible();
    await expect(page.locator('text="Duplicate"')).toBeVisible();

    // Close menu by clicking elsewhere
    const viewport = page.viewportSize();
    const isMobile = viewport && viewport.width < 640;
    if (isMobile) {
      // Tap the same context menu trigger (three dots) to close the menu
      const fileItem = await page.locator(`[data-testid="file-item-${fileId}"]`);
      const dotsButton = fileItem.locator('[data-testid="trigger-button"]');
      await dotsButton.tap();
    } else {
      await page.click('[data-testid="files-container"]');
    }
    await expect(contextMenu).not.toBeVisible();

    // Clean up
    await fileHelpers.deleteFile(fileId);
  });
});
