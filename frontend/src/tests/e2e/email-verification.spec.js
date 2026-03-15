import { test, expect } from "./fixtures.js";
import { AuthHelpers } from "./utils/auth-helpers.js";
import { getTimeouts } from "./utils/timeout-constants.js";

// All tests are @auth-flows — registration and verification are auth entry-point flows
test.describe("Email Verification Flow @auth-flows", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await page.goto("/");
    await authHelpers.clearAuthState();
  });

  // ---------------------------------------------------------------------------
  // 1. Error state — bogus token hits real backend (404)
  // ---------------------------------------------------------------------------

  test("shows link-expired state for an invalid token @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    await page.goto("/verify-email/this-token-does-not-exist");

    // Wait for API call to complete and view to settle
    await expect(page.locator('[data-testid="state-error"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });

    await expect(page.locator('[data-testid="state-error"] h2')).toHaveText("Link expired");

    // Both action buttons must be present
    await expect(page.locator('[data-testid="cta-primary"]')).toBeVisible();
    await expect(page.locator('[data-testid="cta-secondary"]')).toBeVisible();

    await expect(page.locator('[data-testid="cta-primary"]')).toContainText("account settings");
    await expect(page.locator('[data-testid="cta-secondary"]')).toContainText("home");
  });

  test("navigates to /account from error state primary CTA @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    // Need to be authenticated so /account isn't immediately bounced to /login
    await authHelpers.ensureLoggedIn();
    await page.goto("/verify-email/this-token-does-not-exist");

    await expect(page.locator('[data-testid="state-error"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });

    await page.click('[data-testid="cta-primary"]');
    await expect(page).toHaveURL("/account", { timeout: timeouts.navigation });
  });

  // ---------------------------------------------------------------------------
  // 2. Post-registration toast
  // ---------------------------------------------------------------------------

  test("shows verification nudge toast after registration @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();
    const ts = Date.now();
    const testEmail = `verify-e2e-${ts}@example.com`;

    await page.goto("/register");
    await page.waitForSelector('[data-testid="name-input"]', { state: "visible" });

    await page.fill('[data-testid="name-input"]', `Verify User ${ts}`);
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', "testpass123");

    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/register") && r.request().method() === "POST"),
      page.click('[data-testid="register-button"]'),
    ]);

    // Should redirect to home
    await expect(page).toHaveURL("/", { timeout: timeouts.navigation });

    // Persistent "Check your inbox" toast must be visible
    await expect(
      page.locator(".toast-message").filter({ hasText: "Check your inbox" })
    ).toBeVisible({ timeout: timeouts.contentLoad });

    // Toast must contain the registered email in the description
    await expect(page.locator(".toast-description").filter({ hasText: testEmail })).toBeVisible({
      timeout: timeouts.elementRender,
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Success state — mock backend returning 200
  // ---------------------------------------------------------------------------

  test("shows email-verified state when backend returns 200 @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    // Mock the verify-email endpoint to return success
    await page.route("**/users/verify-email/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email verified successfully" }),
      });
    });

    await page.goto("/verify-email/mock-success-token");

    await expect(page.locator('[data-testid="state-success"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });

    await expect(page.locator('[data-testid="state-success"] h2')).toHaveText("Email verified");
    await expect(page.locator('[data-testid="state-success"] p')).toContainText("confirmed");
  });

  test("success CTA says 'Sign in' when not authenticated @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    await page.route("**/users/verify-email/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email verified successfully" }),
      });
    });

    await page.goto("/verify-email/mock-success-token");

    await expect(page.locator('[data-testid="cta-primary"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
    await expect(page.locator('[data-testid="cta-primary"]')).toContainText("Sign in");
  });

  test("success CTA says 'Open Studio' when authenticated @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    await authHelpers.ensureLoggedIn();

    await page.route("**/users/verify-email/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email verified successfully" }),
      });
    });

    await page.goto("/verify-email/mock-success-token");

    await expect(page.locator('[data-testid="cta-primary"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
    await expect(page.locator('[data-testid="cta-primary"]')).toContainText("Open Studio");
  });

  test("success state updates localStorage email_verified flag @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    // Seed localStorage with an unverified user object
    await page.evaluate(() => {
      localStorage.setItem(
        "user",
        JSON.stringify({ id: 99, email: "test@example.com", email_verified: false })
      );
    });

    await page.route("**/users/verify-email/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email verified successfully" }),
      });
    });

    await page.goto("/verify-email/mock-success-token");

    await expect(page.locator('[data-testid="state-success"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });

    const emailVerified = await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.email_verified;
    });
    expect(emailVerified).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 4. Already-verified state — mock backend returning 400
  // ---------------------------------------------------------------------------

  test("shows already-verified state when backend returns 400 @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    await page.route("**/users/verify-email/**", (route) => {
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Email is already verified" }),
      });
    });

    await page.goto("/verify-email/already-used-token");

    await expect(page.locator('[data-testid="state-already-verified"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });

    await expect(page.locator('[data-testid="state-already-verified"] h2')).toHaveText(
      "Already verified"
    );
    await expect(page.locator('[data-testid="cta-primary"]')).toBeVisible();
  });

  test("already-verified CTA navigates to /login when not authenticated @auth-flows", async ({
    page,
  }) => {
    const timeouts = getTimeouts();

    await page.route("**/users/verify-email/**", (route) => {
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Email is already verified" }),
      });
    });

    await page.goto("/verify-email/already-used-token");

    await expect(page.locator('[data-testid="cta-primary"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
    await page.click('[data-testid="cta-primary"]');
    await expect(page).toHaveURL("/login", { timeout: timeouts.navigation });
  });

  // ---------------------------------------------------------------------------
  // 5. Server error state — mock backend returning 500
  // ---------------------------------------------------------------------------

  test("shows server-error state when backend returns 500 @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();

    await page.route("**/users/verify-email/**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal server error" }),
      });
    });

    await page.goto("/verify-email/some-token");

    await expect(page.locator('[data-testid="state-server-error"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });

    await expect(page.locator('[data-testid="state-server-error"] h2')).toHaveText(
      "Something went wrong"
    );
    await expect(page.locator('[data-testid="cta-retry"]')).toBeVisible();
    await expect(page.locator('[data-testid="cta-secondary"]')).toContainText("home");
  });

  test("server-error retry button re-attempts verification @auth-flows", async ({ page }) => {
    const timeouts = getTimeouts();
    let callCount = 0;

    await page.route("**/users/verify-email/**", (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Internal server error" }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Email verified successfully" }),
        });
      }
    });

    await page.goto("/verify-email/some-token");

    await expect(page.locator('[data-testid="state-server-error"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });

    await page.click('[data-testid="cta-retry"]');

    await expect(page.locator('[data-testid="state-success"]')).toBeVisible({
      timeout: timeouts.contentLoad,
    });
  });
});
