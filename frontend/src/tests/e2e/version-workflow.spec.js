/**
 * @file E2E tests for version workflow
 * @tags @auth
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

import { test, expect } from "@playwright/test";
import { AuthHelpers } from "./utils/auth-helpers.js";
import { FileHelpers } from "./utils/file-helpers.js";

test.describe("Version Workflow @auth", () => {
  let fileId;
  let authHelpers;
  let fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    // Login using AuthHelpers
    await authHelpers.login(
      process.env.TEST_USER_EMAIL,
      process.env.TEST_USER_PASSWORD
    );

    // Create a test file using FileHelpers
    fileId = await fileHelpers.createNewFile();

    // Navigate to the file
    await page.goto(`/file/${fileId}`);
    await page.waitForLoadState("domcontentloaded");

    // Open versions drawer
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');
    await page.waitForSelector('[data-testid="save-version-button"]');
  });

  test("creates a new version when clicking Save Version button", async ({ page }) => {
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

    // Wait for save to complete
    await page.waitForTimeout(500);

    // Verify name was updated
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

    // Wait for deletion to complete
    await page.waitForTimeout(500);

    // Verify version was deleted and empty state is shown
    versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(0);

    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
  });

  test.skip("opens preview modal when clicking version row", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });

    // Wait for version to be fully created (API response)
    await page.waitForTimeout(1000);

    // Click on the version row (not the context menu)
    const versionItem = page.locator('[data-testid="version-item"]').first();
    // Click in the middle of the version info area (not on buttons)
    await versionItem.locator('.version-info').click();

    // Modal should appear
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });

    // Verify modal is visible
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Modal should show version number
    await expect(modal).toContainText("Version 1");
  });

  test("modal can be opened multiple times (regression test)", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });
    await page.waitForTimeout(1000);

    const versionItem = page.locator('[data-testid="version-item"]').first();
    const versionInfo = versionItem.locator('.version-info');

    // After creating version, EditableText is in edit mode - press Escape to exit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Open modal first time
    await versionInfo.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });
    let modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Close modal
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible();

    // Open modal second time - THIS IS THE REGRESSION TEST
    await versionInfo.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });
    modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Verify modal content is still correct
    await expect(modal).toContainText("Version 1");

    // Close and open a third time to be sure
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForTimeout(500);
    await versionInfo.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });
    await expect(modal).toBeVisible();
  });

  test("modal can be reopened after closing with X button (regression test)", async ({ page }) => {
    // First, create two versions so we're not clicking on a freshly-created one
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });
    await page.keyboard.press('Escape'); // Exit edit mode
    await page.waitForTimeout(300);

    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]:nth-child(2)', { timeout: 5000 });
    await page.keyboard.press('Escape'); // Exit edit mode
    await page.waitForTimeout(300);

    // Click on the SECOND version (not the one in edit mode)
    const secondVersionItem = page.locator('[data-testid="version-item"]').nth(1);
    const versionInfo = secondVersionItem.locator('.version-info');

    // First open - click the version row
    await versionInfo.click();
    let modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close modal using X button
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible();

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
    await page.waitForTimeout(500);

    // Verify name appears
    await expect(versionItem).toContainText("Test Name");

    // Now clear the name
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');
    await editableInput.fill("");
    await editableInput.press("Enter");
    await page.waitForTimeout(500);

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

    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

    // Now try to rename but cancel with Escape
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');

    await editableInput.fill("Changed Name");
    await editableInput.press("Escape");
    await page.waitForTimeout(300);

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

    // Set up dialog handler to dismiss
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("Delete version");
      dialog.dismiss();
    });

    await page.click('button:has-text("Delete")');
    await page.waitForTimeout(500);

    // Version should still exist
    versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(1);
  });

  test("creates multiple versions with correct numbering", async ({ page }) => {
    // Create 3 versions
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="save-version-button"]');
      await page.waitForTimeout(500);
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
      await page.waitForTimeout(500);
      const versionItem = page.locator('[data-testid="version-item"]').first();
      await versionItem.locator('[data-testid="trigger-button"]').click();
      await page.click('button:has-text("Rename")');
      const editableInput = versionItem.locator("input, textarea").first();
      await editableInput.fill(`Version ${i}`);
      await editableInput.press("Enter");
      await page.waitForTimeout(500);
    }

    // Verify 3 versions exist
    let versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(3);

    // Delete the middle version (Version 2)
    const middleVersion = page.locator('[data-testid="version-item"]:has-text("Version 2")');
    await middleVersion.locator('[data-testid="trigger-button"]').click();

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Delete")');
    await page.waitForTimeout(500);

    // Should have 2 versions remaining
    versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(2);

    // Verify correct versions remain
    await expect(page.locator('[data-testid="version-item"]:has-text("Version 3")')).toBeVisible();
    await expect(page.locator('[data-testid="version-item"]:has-text("Version 1")')).toBeVisible();
    await expect(page.locator('[data-testid="version-item"]:has-text("Version 2")')).not.toBeVisible();
  });

  test("renames different versions independently", async ({ page }) => {
    // Create 2 versions
    await page.click('[data-testid="save-version-button"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="save-version-button"]');
    await page.waitForTimeout(500);

    const versionItems = page.locator('[data-testid="version-item"]');
    await expect(versionItems).toHaveCount(2);

    // Rename first version (v2)
    const firstVersion = versionItems.nth(0);
    await firstVersion.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');
    let editableInput = firstVersion.locator("input, textarea").first();
    await editableInput.fill("Latest Draft");
    await editableInput.press("Enter");
    await page.waitForTimeout(500);

    // Rename second version (v1)
    const secondVersion = versionItems.nth(1);
    await secondVersion.locator('[data-testid="trigger-button"]').click();
    await page.click('button:has-text("Rename")');
    editableInput = secondVersion.locator("input, textarea").first();
    await editableInput.fill("Initial Draft");
    await editableInput.press("Enter");
    await page.waitForTimeout(500);

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
    const longName = "This is a very long version name that might cause display issues if not handled properly with ellipsis or truncation";
    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill(longName);
    await editableInput.press("Enter");

    await page.waitForTimeout(500);

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
    await page.waitForTimeout(300);

    // Modal should NOT have opened
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).not.toBeVisible();

    // Menu should be visible
    await expect(page.locator('button:has-text("Rename")')).toBeVisible();
  });
});
