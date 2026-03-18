import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env file
dotenv.config({ path: path.resolve("../.env") });

// Get ports from environment - NO fallbacks, will crash if not set
const SITE_PORT = process.env.SITE_PORT;
const BACKEND_PORT = process.env.BACKEND_PORT;

if (!SITE_PORT || !BACKEND_PORT) {
  console.error("❌ FATAL: Required environment variables not set");
  console.error(
    "   Missing:",
    [!SITE_PORT && "SITE_PORT", !BACKEND_PORT && "BACKEND_PORT"].filter(Boolean).join(", ")
  );
  console.error("   Ensure .env file exists at project root with all required variables");
  process.exit(1);
}

/**
 * Playwright E2E Test Configuration
 *
 * ELEMENT SELECTION STANDARDS:
 * - ALWAYS use data-testid attributes: [data-testid="menu-toggle"]
 * - AVOID CSS class selectors: .menu-toggle (classes can change)
 * - Use .filter({ hasText: "..." }) for text-based selection
 * - Add data-testid to all interactive elements in components
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.js",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry failed tests - more retries on CI, fewer locally */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? "github" : "line", // Use line reporter for minimal output; --quiet flag suppresses stdout
  /* Global test timeout - max time for individual test */
  timeout: 15000, // Reduced from 60s to match frontend performance expectations
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://localhost:${SITE_PORT}`,
    /* Timeout for individual actions like click, fill, etc. */
    actionTimeout: 5000, // Reduced from 10s to match frontend
    /* Timeout for navigation actions like goto, waitForLoadState */
    navigationTimeout: 8000, // Reduced from 30s to match frontend
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    /* Take screenshot on failure */
    screenshot: "only-on-failure",
    /* Disable video recording for performance */
    video: "off",
    /* Enable touch support for mobile tests */
    hasTouch: true,
  },

  /* Configure projects for major browsers */
  projects: process.env.CI
    ? [
        // CI: All browsers for comprehensive testing
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
        {
          name: "Mobile Chrome",
          use: { ...devices["Pixel 5"] },
        },
        {
          name: "Mobile Firefox",
          use: {
            browserName: "firefox",
            viewport: { width: 393, height: 851 },
            deviceScaleFactor: 2.75,
            hasTouch: true,
            userAgent: "Mozilla/5.0 (Mobile; rv:109.0) Gecko/109.0 Firefox/109.0",
          },
        },
        {
          name: "Mobile Safari",
          use: { ...devices["iPhone 12"] },
        },
      ]
    : [
        // Local: Run only Chromium for faster development
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],

  /* Test against branded browsers. */
  // {
  //   name: 'Microsoft Edge',
  //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
  // },
  // {
  //   name: 'Google Chrome',
  //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  // },

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined // In CI, Docker Compose already runs the site service
    : {
        command: "NODE_ENV=test pnpm run dev",
        url: `http://localhost:${SITE_PORT}`,
        reuseExistingServer: true,
      },
});
