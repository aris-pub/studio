import { expect } from "@playwright/test";
import { TEST_CREDENTIALS } from "../setup/test-data.js";
import { getTimeouts } from "./timeout-constants.js";
import { getBackendURL } from "./test-config.js";

export class AuthHelpers {
  constructor(page) {
    this.page = page;
    // Use E2E-specific API URL for direct backend calls
    this.baseURL = getBackendURL();
  }

  async login(email, password) {
    await this.page.goto("/login", { waitUntil: "commit" });
    // "commit" fires before Vue mounts — wait for the login form to appear.
    await this.page.waitForSelector('[data-testid="email-input"]', {
      state: "visible",
      timeout: 8000,
    });

    await this.page.fill('[data-testid="email-input"]', email);

    await this.page.fill('[data-testid="password-input"]', password);

    // Click login button and wait for response
    await Promise.all([
      this.page.waitForResponse(
        (response) => {
          const isLoginResponse =
            response.url().includes("/login") && response.request().method() === "POST";
          return isLoginResponse;
        },
        { timeout: 10000 }
      ),
      this.page.click('[data-testid="login-button"]'),
    ]);

    // Wait for successful login redirect (deterministic wait)
    await this.page.waitForLoadState("load");
    await this.page.waitForURL(/^(?!.*\/login)/, { timeout: getTimeouts().contentLoad });
  }

  /**
   * API-based token injection - bypasses UI login for speed
   */
  async fastAuth(email = TEST_CREDENTIALS.valid.email, password = TEST_CREDENTIALS.valid.password) {
    try {
      // Ensure we're on a page that allows localStorage access
      const currentUrl = this.page.url();
      if (!currentUrl.includes("localhost")) {
        await this.page.goto("/", { waitUntil: "commit" });
        await this.page.waitForLoadState("domcontentloaded");
      }

      // Direct API login request
      const response = await this.page.request.post(`${this.baseURL}/login`, {
        data: {
          email: email,
          password: password,
        },
      });

      if (!response.ok()) {
        throw new Error(`API login failed: ${response.status()}`);
      }

      const authData = await response.json();

      // Fetch user data using the access token
      const userResponse = await this.page.request.get(`${this.baseURL}/me`, {
        headers: {
          Authorization: `Bearer ${authData.access_token}`,
        },
      });

      if (!userResponse.ok()) {
        throw new Error(`Failed to fetch user data: ${userResponse.status()}`);
      }

      const userData = await userResponse.json();

      // Inject tokens and user data directly into localStorage
      await this.page.evaluate(
        ({ accessToken, refreshToken, user }) => {
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("refreshToken", refreshToken);
          localStorage.setItem("user", JSON.stringify(user));
        },
        {
          accessToken: authData.access_token,
          refreshToken: authData.refresh_token,
          user: userData,
        }
      );

      // Navigate to home page to activate the auth state
      await this.page.goto("/", { waitUntil: "commit" });
      await this.page.waitForLoadState("domcontentloaded");

      // Force Vue app to re-initialize by reloading after localStorage is set
      await this.page.reload();
      await this.page.waitForLoadState("domcontentloaded");

      // Wait for authenticated UI elements to be ready (deterministic wait)
      await this.page.waitForSelector('[data-testid="user-avatar"], [data-testid="user-menu"]', {
        timeout: getTimeouts().contentLoad,
      });

      // Wait for files container to be ready (indicates fileStore is initialized and has data)
      await this.page.waitForSelector(
        '[data-testid="files-container"], [data-testid="create-file-button"]',
        {
          timeout: getTimeouts().contentLoad,
        }
      );

      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Lightweight auth verification - no page loads or redirects
   */
  async verifyLoggedIn() {
    try {
      const tokens = await this.page.evaluate(() => ({
        accessToken: localStorage.getItem("accessToken"),
        user: localStorage.getItem("user"),
      }));

      if (!tokens.accessToken || !tokens.user) {
        return false;
      }

      return true;
    } catch (_error) {
      // localStorage access may fail if no page is loaded
      return false;
    }
  }

  /**
   * Storage state management for shared auth across tests
   */
  async saveAuthState(storageStatePath) {
    await this.page.context().storageState({ path: storageStatePath });
  }

  async loadAuthState(_storageStatePath) {
    // Note: Storage state is loaded at context creation time
  }

  /**
   * Fast authentication with multiple fallback strategies
   */
  async ensureLoggedIn(skipDOMVerification = false) {
    // Navigate to home page first to enable localStorage access
    await this.page.goto("/", { waitUntil: "commit" });
    await this.page.waitForLoadState("domcontentloaded");

    // Check if already authenticated (lightweight)
    if (await this.verifyLoggedIn()) {
      return;
    }

    // Skip API auth in local development if test user isn't configured
    const hasTestUser = process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD;
    if (hasTestUser) {
      // Try fast API auth first
      const fastAuthSuccess = await this.fastAuth();
      if (fastAuthSuccess) {
        if (!skipDOMVerification) {
          await this.page.goto("/", { waitUntil: "commit" });
          await this.page.waitForLoadState("domcontentloaded");
        }
        return;
      }
    }

    // Fallback to original UI-based authentication
    await this.page.goto("/", { waitUntil: "commit" });
    await this.page.waitForLoadState("domcontentloaded");

    // Wait for potential auth redirect to complete (deterministic)
    try {
      await this.page.waitForURL(/^(?!.*\/login)/, { timeout: getTimeouts().contentLoad });
    } catch {
      // If we're still on login page or got redirected there, need to login
      const currentUrl = this.page.url();
      if (currentUrl.includes("/login")) {
        const email = TEST_CREDENTIALS.valid.email;
        const password = TEST_CREDENTIALS.valid.password;

        await this.login(email, password);

        // Verify login was successful by checking URL
        await this.page.waitForURL("/", { timeout: getTimeouts().contentLoad });
      }
    }

    // Verify we have authentication tokens
    let finalAccessToken, finalUser;
    try {
      finalAccessToken = await this.page.evaluate(() => localStorage.getItem("accessToken"));
      finalUser = await this.page.evaluate(() => localStorage.getItem("user"));
    } catch (_error) {
      throw new Error("Failed to access localStorage for token verification");
    }

    if (!finalAccessToken || !finalUser) {
      throw new Error(
        `Authentication verification failed - accessToken: ${!!finalAccessToken}, user: ${!!finalUser}`
      );
    }

    // Skip DOM verification if requested (for speed)
    if (!skipDOMVerification) {
      // Verify we're logged in by checking for home page elements
      await expect(this.page).toHaveURL("/");
      await this.page.waitForSelector(
        '[data-testid="files-container"], [data-testid="create-file-button"], [data-testid="user-menu"]'
      );
    }
  }

  async logout() {
    await this.page.click('[data-testid="user-avatar"]');
    await this.page.click('[data-testid="user-logout"]');
  }

  async clearAuthState() {
    try {
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await this.page.goto("/login", { waitUntil: "domcontentloaded" });
    } catch {
      // Ignore localStorage access errors in tests
    }
  }

  async getStoredTokens() {
    try {
      const tokens = await this.page.evaluate(() => {
        const accessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");
        const userStr = localStorage.getItem("user");

        return {
          accessToken: accessToken,
          refreshToken: refreshToken,
          user: JSON.parse(userStr || "null"),
        };
      });

      return tokens;
    } catch (_error) {
      return { accessToken: null, refreshToken: null, user: null };
    }
  }

  async expectToBeOnLoginPage() {
    // Verify we're on the login page
    await expect(this.page).toHaveURL("/login");

    // Verify login form elements are visible
    await expect(this.page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="login-button"]')).toBeVisible();
  }

  async expectToBeLoggedIn() {
    // Verify we're on the home page (not login page)
    await expect(this.page).toHaveURL("/");

    // Verify that we have logged-in user elements visible (check for user-avatar specifically)
    await expect(this.page.locator('[data-testid="user-avatar"]')).toBeVisible();
  }
}
