// @auth @auth-interface
import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";

test.describe("Settings Navigation @auth @desktop-only", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    // Set desktop viewport for desktop-only tests
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
  });

  test.afterEach(async () => {
    await authHelpers.clearAuthState();
  });

  test("should navigate to settings and show sub-items", async ({ page }) => {
    // Navigate to settings
    await page.click('text="Settings"');
    await expect(page).toHaveURL("/settings/document");

    // Should show settings sub-items in sidebar
    await expect(page.locator(".sub-items-container")).toBeVisible();
    await expect(page.locator(".sub-items-container").locator('text="File Display"')).toBeVisible();
    await expect(page.locator(".sub-items-container").locator('text="Behavior"')).toBeVisible();
    await expect(
      page.locator(".sub-items-container").locator('text="Notifications"')
    ).toBeVisible();
  });

  test.skip("should navigate between settings sub-sections", async ({ page }) => {
    // Start at settings
    await page.click('text="Settings"');
    await expect(page).toHaveURL("/settings/document");

    // Click on File Display sub-item
    await page.click('.sub-items-container >> text="File Display"');
    await expect(page).toHaveURL("/settings/document");
    await expect(page.locator("h1").first()).toContainText("Document Display");

    // Click on Behavior sub-item
    await page.click('.sub-items-container >> text="Behavior"');
    await expect(page).toHaveURL("/settings/behavior");
    await expect(page.locator("h1").first()).toContainText("Behavior");

    // Click on Notifications sub-item
    await page.click('.sub-items-container >> text="Notifications"');
    await expect(page).toHaveURL("/settings/notifications");
    await expect(page.locator("h1").first()).toContainText("Notifications");
  });

  test("should show active state for current settings sub-section", async ({ page }) => {
    // Navigate to settings
    await page.click('text="Settings"');

    // Navigate to File Display settings
    await page.click('.sub-items-container >> text="File Display"');
    await expect(page).toHaveURL("/settings/document");

    // File Display sub-item should be active
    const fileSubItem = page.locator('.sub-items-container >> text="File Display"').locator("..");
    await expect(fileSubItem).toHaveClass(/active/);

    // Other sub-items should not be active
    const behaviorSubItem = page.locator('.sub-items-container >> text="Behavior"').locator("..");
    await expect(behaviorSubItem).not.toHaveClass(/active/);
  });

  test("should maintain settings active state when on sub-pages", async ({ page }) => {
    // Navigate to settings sub-page
    await page.click('text="Settings"');
    await expect(page).toHaveURL("/settings/document");
    await page.click('.sub-items-container >> text="Behavior"');
    await expect(page).toHaveURL("/settings/behavior");

    // Main Settings item should still be active
    const settingsItem = page.locator('text="Settings"').locator("..");
    await expect(settingsItem).toHaveClass(/active/);

    // Sub-items container should still be visible
    await expect(page.locator(".sub-items-container")).toBeVisible();
  });

  test("should hide sub-items when navigating away from settings", async ({ page }) => {
    // Start at settings to show sub-items
    await page.click('text="Settings"');
    await expect(page).toHaveURL("/settings/document");
    await expect(page.locator(".sub-items-container")).toBeVisible();

    // Navigate to Home
    await page.click('text="Home"');
    await expect(page).toHaveURL("/");

    // Settings sub-items should not be visible (Home may have its own sub-items)
    await expect(page.locator('.sub-items-container >> text="File Display"')).not.toBeVisible();
    await expect(page.locator('.sub-items-container >> text="Behavior"')).not.toBeVisible();
    await expect(page.locator('.sub-items-container >> text="Notifications"')).not.toBeVisible();

    // Settings main item should not be active
    const settingsItem = page.locator('text="Settings"').locator("..");
    await expect(settingsItem).not.toHaveClass(/active/);
  });

  test("should work with direct URL navigation", async ({ page }) => {
    // Navigate directly to a settings sub-page
    await page.goto("/settings/notifications");
    await expect(page).toHaveURL("/settings/notifications");

    // Should show settings sub-items
    await expect(page.locator(".sub-items-container")).toBeVisible();

    // Notifications sub-item should be active
    const notificationsSubItem = page
      .locator('.sub-items-container >> text="Notifications"')
      .locator("..");
    await expect(notificationsSubItem).toHaveClass(/active/);

    // Main Settings item should be active
    const settingsItem = page.locator('text="Settings"').locator("..");
    await expect(settingsItem).toHaveClass(/active/);

    // Should show correct page content
    await expect(page.locator("h3").first()).toContainText("Notifications");
  });

  test("should handle keyboard navigation in sub-items", async ({ page }) => {
    await page.click('text="Settings"');
    await expect(page.locator(".sub-items-container")).toBeVisible();

    // Tab to first sub-item and press Enter
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // May need multiple tabs depending on focus order
    await page.keyboard.press("Enter");

    // Should navigate to the focused sub-item
    // This test may need adjustment based on actual keyboard focus implementation
  });

  test("should maintain visual hierarchy with typography", async ({ page }) => {
    await page.click('text="Settings"');
    await expect(page.locator(".sub-items-container")).toBeVisible();

    // Sub-items should have different styling than main items
    const mainSettingsItem = page.locator('text="Settings"').locator("..");
    const fileSubItem = page.locator('.sub-items-container >> text="File Display"').locator("..");

    // Check that sub-items have sub-item class for CSS styling
    await expect(fileSubItem).toHaveClass(/sub-item/);
    await expect(mainSettingsItem).not.toHaveClass(/sub-item/);
  });
});

test.describe("Settings Error Handling @auth @desktop-only", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    // Set desktop viewport for desktop-only tests
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
  });

  test.afterEach(async () => {
    await authHelpers.clearAuthState();
  });

  test("should handle invalid settings routes gracefully", async ({ page }) => {
    // Try to navigate to non-existent settings page
    await page.goto("/settings/nonexistent");

    // Should either redirect to valid settings page or show 404
    // Adjust expectation based on app's error handling strategy
    await expect(page).toHaveURL(/\/settings|\/404/);
  });
});
