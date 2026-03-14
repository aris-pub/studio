import { test, expect } from "./fixtures.js";

// @auth-flows
import { AuthHelpers } from "./utils/auth-helpers.js";
import { TEST_CREDENTIALS } from "./setup/test-data.js";

test.describe("Login Flow Tests @auth-flows", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await page.goto("/");

    await authHelpers.clearAuthState();
  });

  test("successful login - valid credentials, redirect to home, session persistence", async ({
    page,
  }) => {
    // Use real valid credentials for testing
    await authHelpers.login(TEST_CREDENTIALS.valid.email, TEST_CREDENTIALS.valid.password);

    // Verify redirect to home and user is logged in
    await authHelpers.expectToBeLoggedIn();

    // Verify session persistence in localStorage
    const tokens = await authHelpers.getStoredTokens();

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.user.email).toBe(TEST_CREDENTIALS.valid.email);

    // Verify session persists after page refresh
    await page.reload();
    await authHelpers.expectToBeLoggedIn();
  });

  test("invalid credentials - display appropriate error message", async ({ page }) => {
    await page.goto("/login");
    await authHelpers.expectToBeOnLoginPage();

    // Fill in invalid credentials
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.valid.email);
    await page.fill('[data-testid="password-input"]', "wrongpassword");
    await page.click('[data-testid="login-button"]');

    // Verify error message is displayed
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();

    // Verify user remains on login page
    await authHelpers.expectToBeOnLoginPage();

    // Verify no tokens are stored
    const tokens = await authHelpers.getStoredTokens();
    expect(tokens.accessToken).toBeNull();
  });

  test("empty fields validation - browser native validation prevents submission", async ({
    page,
  }) => {
    await page.goto("/login");
    await authHelpers.expectToBeOnLoginPage();

    // Clear any auto-filled dev credentials
    await page.fill('[data-testid="email-input"]', "");
    await page.fill('[data-testid="password-input"]', "");

    // Try to submit with empty fields
    await page.click('[data-testid="login-button"]');

    // Browser native validation or backend rejection keeps us on login
    await authHelpers.expectToBeOnLoginPage();

    // Try with only email filled
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "");
    await page.click('[data-testid="login-button"]');

    // Should remain on login page (missing password)
    await authHelpers.expectToBeOnLoginPage();

    // Verify no tokens were stored after invalid login attempts
    const tokens = await authHelpers.getStoredTokens();
    expect(tokens.accessToken).toBeNull();
  });

  test("network error handling - handle API failures gracefully", async ({ page }) => {
    // Test with backend server down/unreachable
    // This test requires the backend to be unavailable to properly test error handling
    test.skip(true, "Requires backend to be down for proper testing");

    await authHelpers.login(TEST_CREDENTIALS.valid.email, TEST_CREDENTIALS.valid.password);

    // Verify generic error message is shown
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();

    // Verify user remains on login page
    await authHelpers.expectToBeOnLoginPage();
  });

  test("already logged in redirect - auto-redirect to home if valid session exists", async ({
    page,
  }) => {
    // First login to get real valid tokens
    await authHelpers.login(TEST_CREDENTIALS.valid.email, TEST_CREDENTIALS.valid.password);
    await authHelpers.expectToBeLoggedIn();

    // Now try to navigate to login page - should redirect back to home
    await page.goto("/login");

    // Wait for redirect to complete
    await page.waitForURL("/");

    // Should be redirected to home
    await authHelpers.expectToBeLoggedIn();
  });

  test("navigation to register - register link works correctly", async ({ page }) => {
    await page.goto("/login");

    // Click register button
    await page.click('[data-testid="register-link"]');

    // Verify navigation to register page
    await expect(page).toHaveURL("/register");
    await expect(page.locator('[data-testid="name-input"]')).toBeVisible();
  });

  test("enter key login - keyboard shortcut functionality", async ({ page }) => {
    await page.goto("/login");

    // Fill credentials and press Enter
    await page.fill('[data-testid="email-input"]', TEST_CREDENTIALS.valid.email);
    await page.fill('[data-testid="password-input"]', TEST_CREDENTIALS.valid.password);
    await page.press('[data-testid="password-input"]', "Enter");

    // Enter key should submit the form and log in successfully
    await authHelpers.expectToBeLoggedIn();
  });

  test("dev mode auto-fill - pre-filled credentials in development", async ({ page }) => {
    // This test checks if dev mode pre-fills credentials
    // Skip if not in development mode
    const isDev = process.env.NODE_ENV === "development";
    test.skip(!isDev, "Only runs in development mode");

    await page.goto("/login");

    // Check if fields are pre-filled in dev mode
    const emailValue = await page.inputValue('input[type="email"]');
    const passwordValue = await page.inputValue('input[type="password"]');

    expect(emailValue).toBeTruthy();
    expect(passwordValue).toBeTruthy();
  });
});
