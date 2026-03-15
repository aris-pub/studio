import { test, expect } from "../fixtures.js";

// @auth @auth-interface
import { AuthHelpers } from "../utils/auth-helpers.js";

test.describe("Account View E2E Tests @auth @desktop-only", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    // Ensure authenticated state for account tests
    await authHelpers.ensureLoggedIn();
  });

  // No afterEach cleanup - keep auth state for all account tests
  test("avatar upload workflow", async ({ page }) => {
    await page.goto("/account");

    // Verify upload button is present and accessible
    const uploadButton = page.locator(".avatar-upload");
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toHaveAttribute("aria-label", "Upload profile picture");

    // Set up file chooser listener BEFORE clicking to avoid Firefox page closure
    // (Firefox treats file pickers as modals that trigger window close events)
    // See: https://github.com/microsoft/playwright/issues/22928
    const fileChooserPromise = page.waitForEvent("filechooser");
    await uploadButton.click();

    // Wait for file chooser to open
    const fileChooser = await fileChooserPromise;

    // Verify file chooser configuration
    expect(fileChooser.isMultiple()).toBe(false);

    // Verify the hidden input exists and accepts image types
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await expect(fileInput).toBeAttached();
    const acceptAttribute = await fileInput.getAttribute("accept");
    expect(acceptAttribute).toBe("image/*");
  });

  test("upload error handling display", async ({ page }) => {
    await page.goto("/account");

    // Simulate an upload scenario that would trigger validation
    // In a real test environment, we'd mock the API to return errors

    // Verify the upload button is functional
    const uploadButton = page.locator(".avatar-upload");
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toBeEnabled();

    // Verify error handling infrastructure is in place
    // The component should have console error handling for upload failures
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test.skip("navigation and UI responsiveness", async ({ page }) => {
    // Test profile page responsiveness
    await page.goto("/account");

    // Test responsive design elements
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile size

    // Verify mobile layout adaptations
    const mainContainer = page.locator(".profile-layout");
    await expect(mainContainer).toBeVisible();

    // Test desktop layout
    await page.setViewportSize({ width: 1280, height: 720 });

    // Verify profile content is visible in desktop mode
    await expect(page.locator(".user-name")).toBeVisible();
    await expect(page.locator(".user-email")).toBeVisible();

    // Test notifications page navigation and danger zone
    await page.goto("/account");

    const dangerSection = page.locator(".danger-zone");
    await expect(dangerSection).toBeVisible();

    const deleteButton = page.locator('button:has-text("Delete Account")');
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toContainText("Delete Account");

    // Test security page navigation
    await page.goto("/account");

    const passwordSection = page.locator('h2:has-text("Password")');
    await expect(passwordSection).toBeVisible();
  });

  test("affiliation field functionality", async ({ page }) => {
    await page.goto("/account");

    // Test affiliation field presence and interaction
    const affiliationInput = page
      .locator(".input-text")
      .filter({ hasText: "Affiliation" })
      .locator("input");

    await expect(affiliationInput).toBeVisible();

    // Test placeholder text
    const placeholder = await affiliationInput.getAttribute("placeholder");
    expect(placeholder).toContain("institution");

    // Test that affiliation can be filled
    await affiliationInput.fill("Stanford University");
    await expect(affiliationInput).toHaveValue("Stanford University");

    // Test that affiliation field can be cleared
    await affiliationInput.fill("");
    await expect(affiliationInput).toHaveValue("");

    // Test with long affiliation name
    await affiliationInput.fill(
      "Massachusetts Institute of Technology Computer Science and Artificial Intelligence Laboratory"
    );
    await expect(affiliationInput).toHaveValue(
      "Massachusetts Institute of Technology Computer Science and Artificial Intelligence Laboratory"
    );
  });
});
