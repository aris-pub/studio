// @auth @auth-interface
import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";

test.describe("Preferences Unsaved Changes Warning @auth @desktop-only", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
  });

  test.afterEach(async () => {
    await authHelpers.clearAuthState();
  });

  test("should save preferences and persist them across page loads", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.locator("h1").first()).toContainText("Preferences");

    // Wait for settings to load from the server
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveButton).toBeVisible();

    // Toggle a checkbox setting (sidebar auto-collapse is off by default)
    const sidebarCheckbox = page.locator("#sidebar-auto-collapse");
    await sidebarCheckbox.click();

    // Should show unsaved changes warning
    await expect(page.locator(".status-message.warning")).toBeVisible();
    await expect(page.locator(".status-message.warning")).toContainText("unsaved changes");

    // Save settings
    await saveButton.click();

    // Warning should disappear after save
    await expect(page.locator(".status-message.warning")).not.toBeVisible();

    // Reload the page to verify persistence
    await page.reload();
    await expect(page.locator("h1").first()).toContainText("Preferences");
    await expect(saveButton).toBeVisible();

    // The checkbox should still be checked after reload
    await expect(page.locator("#sidebar-auto-collapse")).toBeChecked();

    // No unsaved changes warning should be visible
    await expect(page.locator(".status-message.warning")).not.toBeVisible();

    // Clean up: uncheck and save to restore defaults
    await page.locator("#sidebar-auto-collapse").click();
    await saveButton.click();
  });

  test("should warn when navigating away with unsaved changes", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.locator("h1").first()).toContainText("Preferences");

    // Wait for settings to load
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveButton).toBeVisible();

    // Toggle a setting
    const focusModeCheckbox = page.locator("#focus-mode-auto-hide");
    await focusModeCheckbox.click();

    // Should show unsaved changes warning
    await expect(page.locator(".status-message.warning")).toBeVisible();

    // Set up dialog handler to dismiss the confirm dialog
    page.on("dialog", (dialog) => dialog.dismiss());

    // Try to navigate away
    await page.click('text="Home"');

    // Should still be on preferences (navigation was blocked)
    await expect(page).toHaveURL("/settings/preferences");
  });

  test("should allow navigation without warning when no changes", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.locator("h1").first()).toContainText("Preferences");

    // Wait for settings to load
    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveButton).toBeVisible();

    // No warning should be visible
    await expect(page.locator(".status-message.warning")).not.toBeVisible();

    // Navigate away — should work without prompt
    await page.click('text="Home"');
    await expect(page).toHaveURL("/");
  });

  test("should discard changes when reset is clicked", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.locator("h1").first()).toContainText("Preferences");

    const saveButton = page.locator('[data-testid="save-settings-button"]');
    await expect(saveButton).toBeVisible();

    // Toggle a setting
    await page.locator("#sidebar-auto-collapse").click();
    await expect(page.locator(".status-message.warning")).toBeVisible();

    // Click reset
    const resetButton = page.locator("button", { hasText: "Reset" });
    await resetButton.click();

    // Warning should disappear and checkbox should be unchecked
    await expect(page.locator(".status-message.warning")).not.toBeVisible();
    await expect(page.locator("#sidebar-auto-collapse")).not.toBeChecked();
  });
});
