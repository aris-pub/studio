import { expect } from "@playwright/test";

export class AccountHelpers {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to a specific account sub-page
   */
  async navigateToAccountPage(subPage = "profile") {
    await this.page.goto(`/account/${subPage}`);
    await this.page.waitForLoadState("domcontentloaded");
    // Wait for the account page content to be ready
    await this.page.waitForSelector(".account-container, .status-item, .input-text", {
      timeout: 10000,
    });
  }

  /**
   * Get the current email verification status from the UI
   */
  async getEmailVerificationStatus() {
    await this.navigateToAccountPage("security");

    const emailSection = this.page.locator(".status-item").filter({ hasText: "Email" });
    await expect(emailSection).toBeVisible();

    const statusIndicator = emailSection.locator(".status-indicator");
    const isVerified = await statusIndicator.evaluate((el) => el.classList.contains("verified"));
    const isUnverified = await statusIndicator.evaluate((el) => el.classList.contains("warning"));

    if (isVerified) return "verified";
    if (isUnverified) return "unverified";
    return "unknown";
  }

  /**
   * Send verification email and handle the response
   */
  async sendVerificationEmail() {
    await this.navigateToAccountPage("security");

    // Check if the verification section is visible
    const emailSection = this.page.locator(".status-item").filter({ hasText: "Email" });
    await expect(emailSection).toBeVisible();

    const sendButton = this.page.locator(".verification-actions button");

    // Log if button is found
    const buttonCount = await sendButton.count();

    if (buttonCount === 0) {
      // Check email verification status
      const statusIndicator = emailSection.locator(".status-indicator");
      const _isVerified = await statusIndicator.evaluate((el) => el.classList.contains("verified"));
      const _isUnverified = await statusIndicator.evaluate((el) =>
        el.classList.contains("warning")
      );

      throw new Error("Send verification button not found in .verification-actions");
    }

    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeEnabled();

    // Click and wait for API response
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/send-verification") && response.request().method() === "POST"
    );

    await sendButton.click();
    const response = await responsePromise;

    expect(response.status()).toBe(200);

    let responseData = {};
    try {
      responseData = await response.json();
    } catch (_error) {
      // Ignore JSON parse errors
    }

    return {
      success: response.status() === 200,
      status: response.status(),
      data: responseData,
    };
  }

  /**
   * Change user password through the UI
   */
  async changePassword(currentPassword, newPassword, confirmPassword = null) {
    await this.navigateToAccountPage("security");

    const currentPasswordInput = this.page
      .locator(".input-text")
      .filter({ hasText: /^Current Password$/ })
      .locator("input");
    const newPasswordInput = this.page
      .locator(".input-text")
      .filter({ hasText: /^New Password$/ })
      .locator("input");
    const confirmPasswordInput = this.page
      .locator(".input-text")
      .filter({ hasText: /^Confirm New Password$/ })
      .locator("input");

    // Check if inputs are visible
    await expect(currentPasswordInput).toBeVisible();
    await expect(newPasswordInput).toBeVisible();
    await expect(confirmPasswordInput).toBeVisible();

    await currentPasswordInput.fill(currentPassword);
    await newPasswordInput.fill(newPassword);
    await confirmPasswordInput.fill(confirmPassword || newPassword);

    const updateButton = this.page.locator('button:has-text("Update Password")');
    await expect(updateButton).toBeVisible();
    await expect(updateButton).toBeEnabled();

    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/change-password") && response.request().method() === "POST"
    );

    await updateButton.click();
    const response = await responsePromise;

    let responseData = {};
    try {
      responseData = await response.json();
    } catch (_error) {
      // Ignore JSON parse errors
    }

    return {
      success: response.status() === 200,
      status: response.status(),
      data: responseData,
    };
  }

  /**
   * Update user profile information
   */
  async updateProfile(profileData) {
    await this.navigateToAccountPage("profile");

    if (profileData.name) {
      const nameInput = this.page
        .locator(".input-text")
        .filter({ hasText: "Full Name" })
        .locator("input");
      await nameInput.fill(profileData.name);
    }

    if (profileData.initials) {
      const initialsInput = this.page
        .locator(".input-text")
        .filter({ hasText: "Initials" })
        .locator("input");
      await initialsInput.fill(profileData.initials);
    }

    if (profileData.email) {
      const emailInput = this.page
        .locator(".input-text")
        .filter({ hasText: "Email Address" })
        .locator("input");
      await emailInput.fill(profileData.email);
    }

    if (profileData.affiliation) {
      const affiliationInput = this.page
        .locator(".input-text")
        .filter({ hasText: "Affiliation" })
        .locator("input");
      await affiliationInput.fill(profileData.affiliation);
    }

    const saveButton = this.page.locator('button:has-text("Save Changes")');

    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes("/users/") && response.request().method() === "PUT"
    );

    await saveButton.click();
    const response = await responsePromise;

    return {
      success: response.status() === 200,
      status: response.status(),
      data: await response.json().catch(() => ({})),
    };
  }

  /**
   * Simulate email verification by directly calling the verification endpoint
   */
  async simulateEmailVerification(token) {
    const response = await this.page.request.post(`/users/verify-email/${token}`);

    return {
      success: response.status() === 200,
      status: response.status(),
      data: await response.json().catch(() => ({})),
    };
  }

  /**
   * Get current user information from the UI
   */
  async getCurrentUserInfo() {
    await this.navigateToAccountPage("profile");

    const userName = await this.page.locator(".user-name").textContent();
    const userEmail = await this.page.locator(".user-email").textContent();

    return {
      name: userName?.trim(),
      email: userEmail?.trim(),
    };
  }

  /**
   * Check if user has unsaved changes in any form
   */
  async hasUnsavedChanges() {
    const warningMessage = this.page.locator(".status-message.warning");
    return await warningMessage.isVisible();
  }

  /**
   * Wait for a toast message with specific text
   */
  async waitForToast(text, timeout = 5000) {
    const toast = this.page.locator(".toast").filter({ hasText: text });
    await expect(toast).toBeVisible({ timeout });
    return toast;
  }

  /**
   * Mock API responses for testing error scenarios
   */
  async mockAPIResponse(endpoint, response) {
    await this.page.route(`**${endpoint}`, (route) => {
      route.fulfill({
        status: response.status || 200,
        contentType: "application/json",
        body: JSON.stringify(response.body || {}),
      });
    });
  }

  /**
   * Clear all form fields in the current account page
   */
  async clearAllForms() {
    const inputs = this.page.locator(
      'input[type="text"], input[type="email"], input[type="password"]'
    );
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      await inputs.nth(i).fill("");
    }
  }

  /**
   * Check accessibility of account pages
   */
  async checkAccessibility() {
    // Basic accessibility checks
    const headings = this.page.locator("h1, h2, h3, h4, h5, h6");
    const inputs = this.page.locator("input");
    const buttons = this.page.locator("button");

    // Check that all inputs have labels
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate((el) => {
        return (
          !!el.labels?.length ||
          !!el.getAttribute("aria-label") ||
          !!el.getAttribute("aria-labelledby")
        );
      });
      expect(hasLabel).toBe(true);
    }

    // Check that all buttons have accessible text
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const hasText = await button.evaluate((el) => {
        return !!el.textContent?.trim() || !!el.getAttribute("aria-label");
      });
      expect(hasText).toBe(true);
    }

    return {
      headingsCount: await headings.count(),
      inputsCount: inputCount,
      buttonsCount: buttonCount,
    };
  }
}
