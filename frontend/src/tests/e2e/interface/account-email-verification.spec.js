import { test, expect } from "@playwright/test";
import { AuthHelpers } from "../utils/auth-helpers.js";

// @auth @auth-interface
test.describe("Account Email Verification E2E Tests @auth", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
  });

  test("displays email verification status correctly", async ({ page }) => {
    // Navigate to security page
    await page.goto("/account/security");

    // Wait for the page to load
    await expect(page.locator(".title:has-text('Account Status')")).toBeVisible();

    // Check for email verification status section
    const emailStatusItem = page.locator(".status-item").filter({ hasText: "Email" });
    await expect(emailStatusItem).toBeVisible();

    // The status should show either verified or unverified
    const statusIndicator = emailStatusItem.locator(".status-indicator");
    await expect(statusIndicator).toBeVisible();

    // Check for email address display
    const emailText = emailStatusItem.locator("p");
    await expect(emailText).toBeVisible();
    await expect(emailText).toContainText("@"); // Should contain an email
  });

  test("send verification email workflow for unverified users", async ({ page }) => {
    // Navigate to security page
    await page.goto("/account/security");

    // Look for email verification section
    const emailSection = page.locator(".status-item").filter({ hasText: "Email" });
    await expect(emailSection).toBeVisible();

    // Check if user is unverified (has warning indicator and send button)
    const isUnverified = await emailSection.locator(".status-indicator.warning").isVisible();

    if (isUnverified) {
      // Should have a send verification button in the verification actions
      const sendButton = page.locator(".verification-actions button");

      await expect(sendButton).toBeVisible();
      await expect(sendButton).toBeEnabled();

      // Click the send verification button
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/send-verification") && response.request().method() === "POST"
        ),
        sendButton.click(),
      ]);

      // Should show success message
      await expect(
        page
          .locator(".toast, .status-message")
          .filter({ hasText: /verification email sent|Verification email sent/i })
      ).toBeVisible({ timeout: 5000 });

      // Button should be disabled and show success state
      await expect(sendButton).toBeDisabled();
      await expect(sendButton).toContainText("Verification email sent");
    } else {
      // User is already verified, should show verified status
      const verifiedIndicator = emailSection.locator(".status-indicator.verified");
      await expect(verifiedIndicator).toBeVisible();

      // Should NOT have a send verification button
      const sendButton = page.locator(".verification-actions button");
      await expect(sendButton).not.toBeVisible();
    }
  });

  test("handles verification errors gracefully", async ({ page }) => {
    // Navigate to security page
    await page.goto("/account/security");

    // Mock a network error for the verification request
    await page.route("**/send-verification", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal server error" }),
      });
    });

    const _emailSection = page.locator(".status-item").filter({ hasText: "Email" });
    const sendButton = page.locator(".verification-actions button");

    // Only test if user is unverified and button exists
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Should show error message
      await expect(
        page.locator(".toast, .status-message").filter({ hasText: "Failed" })
      ).toBeVisible({ timeout: 5000 });

      // Button should be re-enabled after error
      await expect(sendButton).toBeEnabled();
    }
  });

  test("email verification status updates correctly", async ({ page }) => {
    // Navigate to security page
    await page.goto("/account/security");

    // Check initial email verification status
    const emailSection = page.locator(".status-item").filter({ hasText: "Email" });
    await expect(emailSection).toBeVisible();

    const statusIndicator = emailSection.locator(".status-indicator");
    await expect(statusIndicator).toBeVisible();

    // The status indicator should have either 'verified' or 'warning' class
    const hasVerifiedClass = await statusIndicator.evaluate((el) =>
      el.classList.contains("verified")
    );
    const hasWarningClass = await statusIndicator.evaluate((el) =>
      el.classList.contains("warning")
    );

    expect(hasVerifiedClass || hasWarningClass).toBe(true);

    if (hasWarningClass) {
      // User is unverified
      await expect(emailSection.locator("h3")).toContainText("Email Not Verified");
      const sendButton = page.locator(".verification-actions button");
      await expect(sendButton).toBeVisible();
    } else {
      // User is verified
      await expect(emailSection.locator("h3")).toContainText("Email Verified");
      const sendButton = page.locator(".verification-actions button");
      await expect(sendButton).not.toBeVisible();
    }
  });

  test("verification button loading state", async ({ page }) => {
    await page.goto("/account/security");

    const sendButton = page.locator(".verification-actions button");

    // Only test if button exists (user is unverified)
    if (await sendButton.isVisible()) {
      // Mock slow response to test loading state
      await page.route("**/send-verification", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Verification email sent successfully" }),
        });
      });

      await sendButton.click();

      // Should show loading state (button disabled, icon might change)
      await expect(sendButton).toBeDisabled();

      // Wait for response (button should remain disabled and show success state)
      await expect(sendButton).toContainText("Verification email sent");
    }
  });
});
