import { test, expect } from "./fixtures.js";

test.describe("Register Form Validation @auth-flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("all fields have the required attribute for native browser validation", async ({ page }) => {
    const nameInput = page.locator('[data-testid="name-input"]');
    const emailInput = page.locator('[data-testid="email-input"]');
    const passwordInput = page.locator('[data-testid="password-input"]');

    await expect(nameInput).toHaveAttribute("required", "");
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("email field uses email input type", async ({ page }) => {
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute("type", "email");
  });

  test("Terms and Privacy links have rel=noopener noreferrer", async ({ page }) => {
    const legalLinks = page.locator(".form-legal a");
    const count = await legalLinks.count();
    expect(count).toBe(2);
    for (let i = 0; i < count; i++) {
      await expect(legalLinks.nth(i)).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("empty form submission stays on register page", async ({ page }) => {
    await page.fill('[data-testid="name-input"]', "");
    await page.fill('[data-testid="email-input"]', "");
    await page.fill('[data-testid="password-input"]', "");

    await page.click('[data-testid="register-button"]');

    await expect(page).toHaveURL(/\/register/);
  });
});
