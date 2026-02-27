import { test, expect } from "../fixtures.js";

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

    await fileHelpers.deleteFile(fileId);
  });

  test("file context menu opens and closes correctly", async ({ page }) => {
    const fileId = await fileHelpers.createNewFile();
    await fileHelpers.navigateToHome();

    const fileExists = await fileHelpers.fileExists(fileId);
    expect(fileExists).toBe(true);

    await fileHelpers.openFileMenu(fileId);

    const contextMenu = page.locator('[data-testid="context-menu"]').first();
    await expect(contextMenu).toBeVisible();
    await expect(page.locator('text="Delete"')).toBeVisible();
    await expect(page.locator('text="Duplicate"')).toBeVisible();

    // Escape is more reliable than click-elsewhere across browsers
    await page.keyboard.press("Escape");
    await expect(contextMenu).not.toBeVisible();

    await fileHelpers.deleteFile(fileId);
  });
});
