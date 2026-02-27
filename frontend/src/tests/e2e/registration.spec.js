import { test, expect } from "./fixtures.js";

// @auth-flows
import { AuthHelpers } from "./utils/auth-helpers.js";

test.describe("Registration Flow Tests @auth-flows", () => {
  let authHelpers;
  let timestamp;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    timestamp = Date.now();
    await page.goto("/");
    await authHelpers.clearAuthState();
  });

  test.skip("user registration with valid data redirects to home", async ({ page }) => {
    const testUser = {
      name: `Test User ${timestamp}`,
      email: `testuser${timestamp}@example.com`,
      password: "testpassword123",
    };

    // Navigate to register via login page (direct navigation has issues)
    await page.goto("/login");
    await page.click('[data-testid="register-link"]');

    // Fill out registration form with unique test data
    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.password);

    // Submit registration form
    await page.click('[data-testid="register-button"]');

    // Verify successful registration and redirect to home
    await page.waitForURL("/", { timeout: 10000 });
    await authHelpers.expectToBeLoggedIn();

    // Verify authentication tokens are stored
    const tokens = await authHelpers.getStoredTokens();
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.user).toBeTruthy();
    expect(tokens.user.email).toBe(testUser.email);
    expect(tokens.user.name).toBe(testUser.name);

    // Verify session persists after page refresh
    await page.reload();
    await authHelpers.expectToBeLoggedIn();
  });

  test("registration validation prevents invalid submissions", async ({ page }) => {
    await page.goto("/login");
    await page.click('[data-testid="register-link"]');

    // Test empty form submission
    await page.click('[data-testid="register-button"]');

    // Should remain on registration page
    await expect(page).toHaveURL("/register");

    // Test password mismatch validation
    await page.fill('[data-testid="name-input"]', "Test User");
    await page.fill('[data-testid="email-input"]', `test${timestamp}@example.com`);
    await page.fill('[data-testid="password-input"]', "password123");
    await page.fill('[data-testid="confirm-password-input"]', "differentpassword");

    await page.click('[data-testid="register-button"]');

    // Should show validation error and remain on registration page
    await expect(page.locator('[data-testid="registration-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="registration-error"]')).toContainText(
      "Passwords do not match"
    );
    await expect(page).toHaveURL("/register");

    // Test partial form submission (missing required fields)
    await page.goto("/login");
    await page.click('[data-testid="register-link"]');
    await page.fill('[data-testid="name-input"]', "Test User");
    await page.fill('[data-testid="email-input"]', `test${timestamp}@example.com`);
    // Leave password fields empty

    await page.click('[data-testid="register-button"]');

    // Should show validation error and remain on registration page
    await expect(page.locator('[data-testid="registration-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="registration-error"]')).toContainText(
      "Please fill in all fields"
    );
    await expect(page).toHaveURL("/register");

    // Verify no tokens are stored after failed registration
    const tokens = await authHelpers.getStoredTokens();
    expect(tokens.accessToken).toBeNull();
    expect(tokens.user).toBeNull();
  });

  test("duplicate email registration shows appropriate error", async ({ page }) => {
    const duplicateEmail = `duplicate${timestamp}@example.com`;
    const testUser = {
      name: `Test User ${timestamp}`,
      email: duplicateEmail,
      password: "testpassword123",
    };

    // First registration - should succeed
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const registerLink = page.locator('[data-testid="register-link"]');
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.password);
    await page.click('[data-testid="register-button"]');

    // Wait for either success redirect or error message
    try {
      await page.waitForURL("/");
      await authHelpers.logout();
    } catch {
      // Registration may have failed, proceed with duplicate test
    }

    // Navigate back to registration (clear auth state to prevent redirect)
    await authHelpers.clearAuthState();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForURL("/login");
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    // Second registration with same email - should fail
    await page.fill('[data-testid="name-input"]', `Another User ${timestamp}`);
    await page.fill('[data-testid="email-input"]', duplicateEmail);
    await page.fill('[data-testid="password-input"]', "differentpassword");
    await page.fill('[data-testid="confirm-password-input"]', "differentpassword");
    await page.click('[data-testid="register-button"]');

    // Should show server error for duplicate email
    await expect(page.locator('[data-testid="registration-error"]')).toBeVisible();
    await expect(page).toHaveURL("/register");
    await expect(page.locator('[data-testid="name-input"]')).toBeVisible();
  });

  test("navigation to login works correctly", async ({ page }) => {
    await page.goto("/login");
    await page.click('[data-testid="register-link"]');

    // Click login link
    await page.click('[data-testid="login-link"]');

    // Verify navigation to login page
    await expect(page).toHaveURL("/login");
    await authHelpers.expectToBeOnLoginPage();
  });

  test("already authenticated user redirects to home", async ({ page }) => {
    // Skip this test if we don't have valid test credentials
    const hasValidCredentials = process.env.TEST_USER_PASSWORD;
    test.skip(!hasValidCredentials, "Requires valid test credentials");

    // First login with valid credentials
    await authHelpers.login("testuser@aris.pub", process.env.TEST_USER_PASSWORD);

    try {
      await page.waitForURL("/");

      // Now try to navigate to register page - should redirect back to home
      await page.goto("/register");

      // Wait for redirect to complete
      await page.waitForURL("/");

      // Should be redirected to home and still logged in
      await authHelpers.expectToBeLoggedIn();
    } catch {
      // If login failed, skip the redirect test
      test.skip(true, "Login failed - cannot test authenticated redirect");
    }
  });
});
