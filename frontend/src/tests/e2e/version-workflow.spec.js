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
 */

import { test, expect } from "@playwright/test";

test.describe("Version Workflow @auth", () => {
  let fileId;

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL("/workspace");

    // Create a test file
    await page.click('[data-testid="new-file-button"]');
    await page.waitForSelector('[data-testid="file-title-input"]');
    await page.fill('[data-testid="file-title-input"]', "Version Workflow Test");

    // Get file ID from URL
    await page.waitForTimeout(500);
    const url = page.url();
    fileId = url.match(/\/file\/(\d+)/)?.[1];

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
    const contextMenuButton = versionItem.locator(".context-menu");
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
    const contextMenuButton = versionItem.locator(".context-menu");
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

  test("opens preview modal when clicking version row", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    // Click on the version row (not the context menu)
    const versionItem = page.locator('[data-testid="version-item"]').first();
    await versionItem.click();

    // Modal should appear
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 5000 });

    // Verify modal is visible
    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Modal should show version number
    await expect(modal).toContainText("Version 1");
  });

  test("modal can be opened multiple times (regression test)", async ({ page }) => {
    // Create a version first
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]');

    const versionItem = page.locator('[data-testid="version-item"]').first();

    // Open modal first time
    await versionItem.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]');
    let modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Close modal
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForTimeout(300);
    await expect(modal).not.toBeVisible();

    // Open modal second time - THIS IS THE REGRESSION TEST
    await versionItem.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]');
    modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();

    // Verify modal content is still correct
    await expect(modal).toContainText("Version 1");

    // Close and open a third time to be sure
    await page.click('[data-testid="close-preview-modal"]');
    await page.waitForTimeout(300);
    await versionItem.click();
    await page.waitForSelector('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible();
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
    const contextMenuButton = versionItem.locator(".context-menu");
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
});
