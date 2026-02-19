/**
 * @file E2E tests for version workflow
 * @tags @auth @auth-content
 *
 * Tests essential version management flows:
 * 1. Creating versions
 * 2. Renaming versions via context menu
 * 3. Deleting versions via context menu
 * 4. Opening preview modal
 * 5. Modal re-opening (regression test)
 * 6. Edge cases (empty names, special characters, canceling)
 * 7. Multi-version scenarios
 */

import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";

test.describe("Version Workflow @auth", () => {
  let fileId;
  let authHelpers;
  let fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    // Ensure logged in (skips if already authenticated)
    await authHelpers.ensureLoggedIn();

    // Create a test file using FileHelpers
    fileId = await fileHelpers.createNewFile();
    console.log(`[TEST] Created file with ID: ${fileId}`);

    // Navigate to the file
    await page.goto(`/file/${fileId}`, { waitUntil: "commit" });
    await page.waitForLoadState("domcontentloaded");

    // Open versions drawer
    await page.waitForSelector('[data-testid="workspace-sidebar"]', {
      state: "visible",
      timeout: 5000,
    });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');
    await page.waitForSelector('[data-testid="save-version-button"]', { state: "visible" });

    // Wait for drawer animation to complete (0.3s transition)
    // We wait for the drawer to reach its final position by checking CSS
    await page.waitForFunction(
      () => {
        const drawer = document.querySelector(".drawer.active");
        if (!drawer) return false;
        const styles = window.getComputedStyle(drawer);
        return styles.left === "64px" && styles.opacity === "1";
      },
      { timeout: 1000 }
    );
  });

  test.afterEach(async () => {
    if (fileId) {
      console.log(`[TEST] Deleting file with ID: ${fileId}`);
      await fileHelpers.deleteFile(fileId);
      console.log(`[TEST] File ${fileId} deleted successfully`);
    }
  });

  test("creates a new version when clicking Save Version button", async ({ page }) => {
    // Wait for versions to load (loading state to disappear)
    await page.waitForSelector(".loading", { state: "hidden", timeout: 5000 });

    // Initially should show empty state
    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("No versions yet");

    // Click Save Version button
    await page.click('[data-testid="save-version-button"]');

    // Wait for version to be created and displayed
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });

    // Verify version item exists
    const versionItem = page.locator('[data-testid="version-item"]').first();
    await expect(versionItem).toBeVisible();

    // Verify version has number
    await expect(versionItem).toContainText("v1");

    // Empty state should no longer be visible
    await expect(emptyState).not.toBeVisible();
  });

  test("renames version via context menu", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    // Find the version item
    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Find and click the context menu button (ButtonDots)
    const contextMenuButton = versionItem.locator('[data-testid="trigger-button"]');
    await contextMenuButton.click();

    // Wait for menu to appear and click Rename
    await page.waitForSelector('button:has-text("Rename")');
    await page.click('button:has-text("Rename")');

    // EditableText should now be in edit mode
    // Type a new name
    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill("First Draft");
    await editableInput.press("Enter");

    // Verify name was updated (expect has implicit waiting)
    await expect(versionItem).toContainText("First Draft");
  });

  test("deletes version via context menu with confirmation", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    // Verify version exists
    let versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(1);

    // Find the version item and open context menu
    const versionItem = versionItems.first();
    const contextMenuButton = versionItem.locator('[data-testid="trigger-button"]');
    await contextMenuButton.click();

    // Click Delete
    await page.waitForSelector('button:has-text("Delete")');

    // Set up dialog handler for confirmation
    page.on("dialog", (dialog) => {
      expect(dialog.message()).toContain("Delete version");
      dialog.accept();
    });

    await page.click('button:has-text("Delete")');

    // Verify version was deleted (expect has implicit waiting)
    versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(0);

    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
  });

  test("opens preview modal when clicking version row", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });

    // Wait for version to be fully created (API response)

    // Press Escape to exit edit mode
    await page.keyboard.press("Escape");

    // Click on the version row (not the context menu)
    const versionItem = page.locator('[data-testid="version-item"]').first();
    // Click in the middle of the version info area (not on buttons)
    await versionItem.locator(".version-info").click();

    // Modal should appear
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });

    // Verify modal is visible
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Modal should show version number
    await expect(modal).toContainText("Version 1");
  });

  test("clicking version row works after hover (regression test for CSS transform)", async ({
    page,
  }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });
    await page.keyboard.press("Escape"); // Exit edit mode

    const versionItem = page.locator('[data-testid="version-item"]').first();
    const versionInfo = versionItem.locator(".version-info");

    // Hover over the version item to trigger CSS hover state
    await versionItem.hover();

    // Click while in hover state - this catches CSS issues like transform breaking click detection
    await versionInfo.click();

    // Modal should open despite hover state
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal).toContainText("Version 1");
  });

  test("modal can be opened multiple times (regression test)", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });

    const versionItem = page.locator('[data-testid="version-item"]').first();
    const versionInfo = versionItem.locator(".version-info");

    // After creating version, EditableText is in edit mode - press Escape to exit
    await page.keyboard.press("Escape");

    // Open modal first time
    await versionInfo.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });
    let modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Close modal
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForSelector('[data-testid="version-preview-modal"]', { state: "detached" });

    // Open modal second time - THIS IS THE REGRESSION TEST
    await versionInfo.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });
    modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Verify modal content is still correct
    await expect(modal).toContainText("Version 1");

    // Close and open a third time to be sure
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForSelector('[data-testid="version-preview-modal"]', { state: "detached" });
    await versionInfo.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });
    await expect(modal).toBeVisible();
  });

  test("modal can be reopened after closing with X button (regression test)", async ({ page }) => {
    // First, create two versions so we're not clicking on a freshly-created one
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });
    await page.keyboard.press("Escape"); // Exit edit mode

    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]:nth-child(2)', { timeout: 5000 });
    await page.keyboard.press("Escape"); // Exit edit mode

    // Click on the SECOND version (not the one in edit mode)
    const secondVersionItem = page.locator('[data-testid="version-item"]').nth(1);
    const versionInfo = secondVersionItem.locator(".version-info");

    // First open - click the version row
    await versionInfo.click();
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close modal using X button
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForSelector('[data-testid="version-preview-modal"]', { state: "detached" });

    // THIS IS THE BUG TEST: Try to reopen modal
    await versionInfo.click();

    // Modal should open again
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test("displays version metadata correctly", async ({ page }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Should display version number
    await expect(versionItem).toContainText("v1");

    // Should display date (relative format like "Today at" or "X ago")
    const versionMeta = versionItem.locator(".version-meta");
    await expect(versionMeta).toBeVisible();

    // Should contain either "Today at" or "ago" or other date format
    const metaText = await versionMeta.textContent();
    const hasValidDate =
      metaText.includes("Today") ||
      metaText.includes("ago") ||
      metaText.includes("Yesterday") ||
      /[A-Z][a-z]{2}\s\d+/.test(metaText); // e.g., "Feb 12"

    expect(hasValidDate).toBe(true);
  });

  test("shows context menu with correct icons", async ({ page }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Open context menu
    const contextMenuButton = versionItem.locator('[data-testid="trigger-button"]');
    await contextMenuButton.click();

    // Wait for menu to appear
    await page.waitForSelector('button:has-text("Rename")');

    // Verify menu items exist
    const renameButton = page.locator('button:has-text("Rename")');
    const deleteButton = page.locator('button:has-text("Delete")');

    await expect(renameButton).toBeVisible();
    await expect(deleteButton).toBeVisible();

    // Verify icons are present (pencil and trash)
    // Icon component renders as .tabler-icon
    const renameIcon = renameButton.locator(".tabler-icon");
    const deleteIcon = deleteButton.locator(".tabler-icon");

    await expect(renameIcon).toBeVisible();
    await expect(deleteIcon).toBeVisible();
  });

  test("handles empty version name (no visual name)", async ({ page }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Verify unnamed version shows version number (no custom name displayed)
    await expect(versionItem).toContainText("v1");

    // Open context menu and rename with actual text
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');

    // Fill with name then clear it
    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill("Test Name");
    await editableInput.press("Enter");

    // Verify name appears
    await expect(versionItem).toContainText("Test Name");

    // Now clear the name
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');
    await editableInput.fill("");
    await editableInput.press("Enter");

    // After clearing, should still show version number (no custom name)
    await expect(versionItem).toContainText("v1");
  });

  test("handles special characters in version name", async ({ page }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Open rename
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');

    // Type name with special characters
    const specialName = "Draft v1.0 (final) – 2024";
    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill(specialName);
    await editableInput.press("Enter");

    // Verify special characters are preserved
    await expect(versionItem).toContainText(specialName);
  });

  test("allows canceling rename by pressing Escape", async ({ page }) => {
    // Create and name a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');

    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill("Original Name");
    await editableInput.press("Enter");

    // Now try to rename but cancel with Escape
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');

    await editableInput.fill("Changed Name");
    await editableInput.press("Escape");

    // Original name should still be there
    await expect(versionItem).toContainText("Original Name");
    await expect(versionItem).not.toContainText("Changed Name");
  });

  test("allows canceling delete by dismissing dialog", async ({ page }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    let versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(1);

    // Try to delete but cancel
    const versionItem = versionItems.first();
    await versionItem.locator('[data-testid="trigger-button"]').click();

    // Wait for Delete button to be ready
    await page.waitForSelector('button:has-text("Delete")');

    // Set up dialog handler to dismiss (same pattern as the working delete test)
    page.on("dialog", (dialog) => {
      expect(dialog.message()).toContain("Delete version");
      dialog.dismiss();
    });

    await page.click('button:has-text("Delete")');

    // Version should still exist
    versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(1);
  });

  test("creates multiple versions with correct numbering", async ({ page }) => {
    // Create 3 versions
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="save-version-button"]');
    }

    // Wait for all versions to appear
    const versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(3);

    // Verify version numbers (newest first)
    const firstVersion = versionItems.nth(0);
    const secondVersion = versionItems.nth(1);
    const thirdVersion = versionItems.nth(2);

    await expect(firstVersion).toContainText("v3");
    await expect(secondVersion).toContainText("v2");
    await expect(thirdVersion).toContainText("v1");
  });

  test("deletes specific version when multiple exist", async ({ page }) => {
    // Create 3 versions with names
    for (let i = 1; i <= 3; i++) {
      await page.click('[data-testid="save-version-button"]');
      await page.waitForSelector('[data-testid="version-item"]');

      // New version auto-enters edit mode, so we can directly fill the name
      const versionItem = page.locator('[data-testid="version-item"]').first();
      const editableInput = versionItem.locator("input, textarea").first();
      await editableInput.waitFor({ state: "visible", timeout: 3000 });
      await editableInput.fill(`Version ${i}`);
      await editableInput.press("Enter");

      // Wait for edit mode to exit before next iteration
      await editableInput.waitFor({ state: "hidden", timeout: 3000 });
    }

    // Verify 3 versions exist
    let versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(3);

    // Delete the middle version (Version 2)
    const middleVersion = page.locator('[data-testid="version-item"]:has-text("Version 2")');
    await middleVersion.locator('[data-testid="trigger-button"]').click();

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Delete")');

    // Should have 2 versions remaining
    versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(2);

    // Verify correct versions remain
    await expect(page.locator('[data-testid="version-item"]:has-text("Version 3")')).toBeVisible();
    await expect(page.locator('[data-testid="version-item"]:has-text("Version 1")')).toBeVisible();
    await expect(
      page.locator('[data-testid="version-item"]:has-text("Version 2")')
    ).not.toBeVisible();
  });

  test("renames different versions independently", async ({ page }) => {
    // Create 2 versions
    await page.click('[data-testid="save-version-button"]');
    await page.click('[data-testid="save-version-button"]');

    const versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(2);

    // Rename first version (v2)
    const firstVersion = versionItems.nth(0);
    await firstVersion.locator('[data-testid="trigger-button"]').click();
    await page.waitForSelector('button:has-text("Rename")');
    await page.click('button:has-text("Rename")');
    let editableInput = firstVersion.locator("input, textarea").first();
    await editableInput.fill("Latest Draft");
    await editableInput.press("Enter");

    // Rename second version (v1)
    const secondVersion = versionItems.nth(1);
    await secondVersion.locator('[data-testid="trigger-button"]').click();
    await page.waitForSelector('button:has-text("Rename")');
    await page.click('button:has-text("Rename")');
    editableInput = secondVersion.locator("input, textarea").first();
    await editableInput.fill("Initial Draft");
    await editableInput.press("Enter");

    // Verify both names are correct
    await expect(firstVersion).toContainText("Latest Draft");
    await expect(firstVersion).toContainText("v2");
    await expect(secondVersion).toContainText("Initial Draft");
    await expect(secondVersion).toContainText("v1");
  });

  test("handles very long version names", async ({ page }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Open rename
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');

    // Type a very long name
    const longName =
      "This is a very long version name that might cause display issues if not handled properly with ellipsis or truncation";
    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill(longName);
    await editableInput.press("Enter");

    // Verify the name was saved (even if visually truncated)
    const versionNameElement = versionItem.locator(".version-name");
    const savedText = await versionNameElement.textContent();
    expect(savedText.length).toBeGreaterThan(50); // Should contain most/all of the long name
  });

  test("clicking context menu doesn't trigger row click", async ({ page }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Click the context menu button
    await versionItem.locator('[data-testid="trigger-button"]').click();

    // Wait a moment

    // Modal should NOT have opened
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).not.toBeVisible();

    // Menu should be visible
    await expect(page.locator('button:has-text("Rename")')).toBeVisible();
  });

  test("clicking version name opens modal (regression test)", async ({ page }) => {
    // Create a version with a name
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });

    const versionItem = page.locator('[data-testid="version-item"]').first();
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');
    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill("Test Version");
    await editableInput.press("Enter");

    // Click on the version name text (not the input, the displayed text)
    const versionName = versionItem.locator(".version-name");
    await versionName.click();

    // Modal should open
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test("pressing ESC in modal closes only modal, not drawer (regression test)", async ({
    page,
  }) => {
    // Create a version
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });
    await page.keyboard.press("Escape"); // Exit edit mode

    const versionItem = page.locator('[data-testid="version-item"]').first();
    const versionInfo = versionItem.locator(".version-info");

    // Open modal by clicking version
    await versionInfo.click();
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Press ESC to close modal
    await page.keyboard.press("Escape");

    // Modal should be closed
    await expect(modal).not.toBeVisible();

    // Drawer should still be open (versions list still visible)
    const saveVersionButton = page.locator('[data-testid="save-version-button"]');
    await expect(saveVersionButton).toBeVisible();
    await expect(versionItem).toBeVisible();
  });
});
