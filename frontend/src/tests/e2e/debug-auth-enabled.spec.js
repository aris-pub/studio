import { test, expect } from "@playwright/test";

// @auth
import { AuthHelpers } from "./utils/auth-helpers.js";
import { TEST_CREDENTIALS } from "./setup/test-data.js";

const backendURL = process.env.VITE_API_BASE_URL;

test.describe("Debug Auth-Enabled Desktop Failures @auth", () => {
  let authHelpers;
  let consoleMessages = [];
  let jsErrors = [];

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    consoleMessages = [];
    jsErrors = [];

    // Capture all console messages and errors
    page.on("console", (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
    });

    page.on("requestfailed", (_request) => {
      // Capture failed requests
    });

    // Clear auth state
    await authHelpers.clearAuthState();
  });

  test("diagnose auth-enabled store initialization failure", async ({ page }) => {
    // Step 1: Verify backend is accessible
    const healthResponse = await page.request.get(`${backendURL}/health`);
    expect(healthResponse.ok()).toBeTruthy();

    // Step 2: Go to home page (should redirect to login)
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Step 3: Attempt login
    await authHelpers.login(TEST_CREDENTIALS.valid.email, TEST_CREDENTIALS.valid.password);

    // Step 4: Wait for post-login navigation and capture state
    try {
      await expect(page).toHaveURL("/", { timeout: 15000 });
    } catch (_error) {
      // May not redirect immediately
    }

    // Step 5: Check authentication state in localStorage
    const authState = await page.evaluate(() => ({
      accessToken: localStorage.getItem("accessToken"),
      user: JSON.parse(localStorage.getItem("user") || "null"),
    }));

    expect(authState.user).toBeTruthy();

    // Step 6: Check Vue app and store state
    const vueState = await page.evaluate(() => {
      try {
        // Try multiple ways to access the Vue app instance
        const appElement = document.querySelector("#app");
        let app = null;
        let root = null;

        // Method 1: Check if app is attached to DOM element
        if (appElement && appElement.__vue_app__) {
          app = appElement.__vue_app__;
          root = app._instance;
        }

        // Method 2: Check global Vue app instance
        if (!app && window.app) {
          app = window.app;
          root = app._instance;
        }

        // Method 3: Try to access via Vue devtools global
        if (!app && window.__VUE__) {
          app = window.__VUE__;
          root = app._instance;
        }

        // Get provides/inject values from the root component
        let provides = null;
        if (root && root.provides) {
          provides = root.provides;
        } else if (root && root.ctx && root.ctx.provides) {
          provides = root.ctx.provides;
        }

        // Extract values from reactive refs
        const getUserValue = () => {
          if (!provides?.user) return null;
          // Handle both ref objects and direct values
          return provides.user.value || provides.user;
        };

        const getFileStoreValue = () => {
          if (!provides?.fileStore) return null;
          // Handle both ref objects and direct values
          return provides.fileStore.value || provides.fileStore;
        };

        const user = getUserValue();
        const fileStore = getFileStoreValue();

        return {
          hasApp: !!app,
          hasRoot: !!root,
          hasProvides: !!provides,
          hasUser: !!user,
          hasFileStore: !!fileStore,
          hasApi: !!provides?.api,
          userValue: user
            ? {
                id: user.id,
                email: user.email,
                name: user.name,
              }
            : null,
          fileStoreState: fileStore
            ? {
                hasFiles: !!fileStore.files,
                filesLoaded:
                  Array.isArray(fileStore.files?.value) || Array.isArray(fileStore.files),
                filesCount: fileStore.files?.value?.length || fileStore.files?.length || 0,
                hasTags: !!fileStore.tags,
                tagsLoaded: Array.isArray(fileStore.tags?.value) || Array.isArray(fileStore.tags),
                tagsCount: fileStore.tags?.value?.length || fileStore.tags?.length || 0,
                isLoading: fileStore.isLoading?.value || fileStore.isLoading || false,
              }
            : null,
          appLoading: provides?.isAppLoading?.value || provides?.isAppLoading,
          debugInfo: {
            appElement: !!appElement,
            hasVueApp: !!(appElement && appElement.__vue_app__),
            hasWindowApp: !!window.app,
            hasVueGlobal: !!window.__VUE__,
            providesKeys: provides ? Object.keys(provides) : [],
            rootType: root ? typeof root : "null",
            providesType: provides ? typeof provides : "null",
          },
        };
      } catch (error) {
        return {
          error: error.message,
          stack: error.stack,
          hasApp: false,
          hasRoot: false,
          hasProvides: false,
          hasUser: false,
          hasFileStore: false,
        };
      }
    });

    if (vueState.error) {
      // Vue state error captured
    }

    // Step 7: Check for specific UI elements that should be present

    const uiElements = {
      userAvatar: await page.locator('[data-testid="user-avatar"]').count(),
      filesContainer: await page.locator('[data-testid="files-container"]').count(),
      createFileButton: await page.locator('[data-testid="create-file-button"]').count(),
    };

    // Step 8: Test API calls that are failing

    // Test backend user state endpoint
    try {
      const debugResponse = await page.request.get(`${backendURL}/debug/user-state`);
      if (debugResponse.ok()) {
        await debugResponse.json();
      }
    } catch (_error) {
      // Expected to fail
    }

    if (authState.user?.id) {
      const userId = authState.user.id;

      // Test avatar endpoint (known to fail)
      try {
        await page.request.get(`${backendURL}/users/${userId}/avatar`, {
          headers: authState.accessToken
            ? { Authorization: `Bearer ${authState.accessToken}` }
            : {},
        });
      } catch (_error) {
        // Expected to fail
      }

      // Test user settings endpoint (known to fail)
      try {
        await page.request.get(`${backendURL}/settings/${userId}`, {
          headers: authState.accessToken
            ? { Authorization: `Bearer ${authState.accessToken}` }
            : {},
        });
      } catch (_error) {
        // Expected to fail
      }
    }

    // Step 9: Capture page content for analysis
    const pageContent = await page.textContent("body");
    const hasErrorContent =
      pageContent.includes("Error") ||
      pageContent.includes("404") ||
      pageContent.includes("Network Error");

    // Step 10: Captured console messages and errors available for debugging

    // This test is for diagnostics - we expect it might "fail" to gather information
    // The actual assertion just ensures we captured the state
    expect(authState.accessToken).toBeTruthy(); // At minimum, login should work
  });
});
