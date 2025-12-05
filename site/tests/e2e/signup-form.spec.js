/**
 * @file E2E tests for the signup form on the landing page
 */

import { test, expect } from "@playwright/test";

test.describe("Signup Form", () => {
  test.beforeEach(async ({ page }) => {
    // Use baseURL from playwright config
    await page.goto("/");
  });

  test("should display the signup form", async ({ page }) => {
    // Navigate to signup section
    await page.click('a[href="#signup"]');

    // Wait for form to be visible
    await expect(page.locator(".signup-form")).toBeVisible();

    // Check all form elements are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(
      page.locator("text=Which tools will you use for your next publication?")
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show all authoring tool options", async ({ page }) => {
    // Navigate to form
    await page.click('a[href="#signup"]');

    // Check all expected tools are present
    const expectedTools = [
      "LaTeX (including Overleaf)",
      "Markdown (any variant)",
      "Typst",
      "Quarto",
      "MS Word",
      "Google Docs",
    ];

    for (const tool of expectedTools) {
      await expect(page.locator(".checkbox-group").locator(`text=${tool}`)).toBeVisible();
    }

    // Check "Other" option is present
    await expect(page.locator(".checkbox-group").locator("text=Other:")).toBeVisible();
    await expect(page.locator('input[placeholder="Please specify"]')).toBeVisible();
  });

  test("should enable other tool input when other checkbox is selected", async ({ page }) => {
    await page.click('a[href="#signup"]');

    const otherInput = page.locator('input[placeholder="Please specify"]');

    // Input should be disabled initially
    await expect(otherInput).toBeDisabled();

    // Click "Other" checkbox
    await page
      .locator(".checkbox-group")
      .locator("text=Other:")
      .locator('input[type="checkbox"]')
      .click();

    // Input should now be enabled
    await expect(otherInput).toBeEnabled();

    // Should be able to type in it
    await otherInput.fill("Custom Tool");
    await expect(otherInput).toHaveValue("Custom Tool");
  });

  test("should submit form with minimal data (email only)", async ({ page }) => {
    // Mock the API call
    await page.route("**/signup/", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          email: "test@example.com",
          authoring_tools: null,
          status: "active",
          unsubscribe_token: "test-token",
          created_at: "2025-08-04T12:00:00Z",
        }),
      });
    });

    await page.click('a[href="#signup"]');

    // Fill only email
    await page.fill('input[type="email"]', "test@example.com");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator(".thank-you-message")).toBeVisible();
    await expect(page.locator("text=Thank you for your interest!")).toBeVisible();
  });

  test("should submit form with all data", async ({ page }) => {
    // Mock the API call
    await page.route("**/signup/", async (route) => {
      const request = route.request();
      const requestBody = JSON.parse(await request.postData());

      // Verify request structure
      expect(requestBody).toHaveProperty("email", "fulldata@example.com");
      expect(requestBody).toHaveProperty("authoring_tools");
      expect(requestBody.authoring_tools).toContain("LaTeX (including Overleaf)");
      expect(requestBody.authoring_tools).toContain("Custom Tool");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 2,
          email: "fulldata@example.com",
          authoring_tools: requestBody.authoring_tools,
          status: "active",
          unsubscribe_token: "test-token-2",
          created_at: "2025-08-04T12:00:00Z",
        }),
      });
    });

    await page.click('a[href="#signup"]');

    // Fill email
    await page.fill('input[type="email"]', "fulldata@example.com");

    // Select some authoring tools
    await page
      .locator(".checkbox-group")
      .locator("text=LaTeX (including Overleaf)")
      .locator('input[type="checkbox"]')
      .click();
    await page
      .locator(".checkbox-group")
      .locator("text=Markdown (any variant)")
      .locator('input[type="checkbox"]')
      .click();

    // Select "Other" and specify custom tool
    await page
      .locator(".checkbox-group")
      .locator("text=Other:")
      .locator('input[type="checkbox"]')
      .click();
    await page.fill('input[placeholder="Please specify"]', "Custom Tool");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator(".thank-you-message")).toBeVisible();
  });

  test("should show validation error for invalid email", async ({ page }) => {
    await page.click('a[href="#signup"]');

    // Fill invalid email
    await page.fill('input[type="email"]', "invalid-email");

    // Try to submit
    await page.click('button[type="submit"]');

    // Form should show validation error (browser validation)
    // Note: This tests browser-level validation, not our custom validation
    const emailInput = page.locator('input[type="email"]');
    const validationMessage = await emailInput.evaluate((el) => el.validationMessage);
    expect(validationMessage).toBeTruthy(); // Should have some validation message
  });

  test("should show error message on API failure", async ({ page }) => {
    // Mock API failure
    await page.route("**/signup/", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            error: "internal_error",
            message: "Something went wrong. Please try again later.",
          },
        }),
      });
    });

    await page.click('a[href="#signup"]');

    // Fill email
    await page.fill('input[type="email"]', "error@example.com");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator(".error-message")).toBeVisible();
    await expect(page.locator("text=Something went wrong. Please try again later.")).toBeVisible();
  });

  test("should show duplicate email error", async ({ page }) => {
    // Mock duplicate email error
    await page.route("**/signup/", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          detail: {
            error: "duplicate_email",
            message: "This email address is already registered for early access",
          },
        }),
      });
    });

    await page.click('a[href="#signup"]');

    // Fill email
    await page.fill('input[type="email"]', "duplicate@example.com");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show duplicate email error
    await expect(page.locator(".error-message")).toBeVisible();
    await expect(page.locator("text=This email address is already registered")).toBeVisible();
  });

  test("should show loading state during submission", async ({ page }) => {
    // Mock slow API response
    await page.route("**/signup/", async (route) => {
      // Delay response
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 3,
          email: "slow@example.com",
          authoring_tools: null,
          status: "active",
          unsubscribe_token: "test-token",
          created_at: "2025-08-04T12:00:00Z",
        }),
      });
    });

    await page.click('a[href="#signup"]');

    // Fill email
    await page.fill('input[type="email"]', "slow@example.com");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show loading state
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await expect(page.locator("text=Submitting...")).toBeVisible();

    // Wait for completion
    await expect(page.locator(".thank-you-message")).toBeVisible();
  });

  test("should have consistent row heights in checkbox grid", async ({ page }) => {
    await page.click('a[href="#signup"]');

    // Get all checkbox rows
    const checkboxLabels = page.locator(
      ".checkbox-group .checkbox-label, .checkbox-group .other-tool"
    );
    const count = await checkboxLabels.count();

    // Get heights of all rows
    const heights = [];
    for (let i = 0; i < count; i++) {
      const element = checkboxLabels.nth(i);
      const box = await element.boundingBox();
      heights.push(box.height);
    }

    // All heights should be the same (28px as set in CSS)
    const expectedHeight = 28;
    for (const height of heights) {
      expect(Math.abs(height - expectedHeight)).toBeLessThan(2); // Allow 1px tolerance
    }
  });

  test("should navigate to signup section from navbar CTA", async ({ page }) => {
    // Wait for Nuxt hydration - toggles are disabled until hydrated
    await page.waitForFunction(() => {
      const toggles = document.querySelectorAll('[data-testid="dark-mode-toggle"]');
      return toggles.length > 0 && !toggles[0].disabled;
    });

    // Check if we're on mobile and need to open hamburger menu first
    const isMobile = page.viewportSize()?.width < 768;

    if (isMobile) {
      // On mobile, open hamburger menu first
      const hamburger = page.locator(".nav-hamburger");
      await expect(hamburger).toBeVisible();
      await hamburger.click();

      // Wait for mobile menu to open and CTA button to be visible
      const mobileMenu = page.locator(".nav-mobile.nav-mobile-open");
      await expect(mobileMenu).toBeVisible();
      const ctaButton = mobileMenu.locator(".nav-cta-button");
      await expect(ctaButton).toBeVisible();
      await ctaButton.click();
    } else {
      // Click navbar CTA button directly on desktop
      await page.click(".nav-cta-button");
    }

    // Should scroll to signup section
    await expect(page.locator(".signup-form")).toBeInViewport();
  });

  test("should navigate to signup section from hero CTA", async ({ page }) => {
    // Click hero CTA button
    await page.click(".hero-cta-button");

    // Should scroll to signup section
    await expect(page.locator(".signup-form")).toBeInViewport();
  });
});
