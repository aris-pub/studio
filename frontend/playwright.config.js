import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env file
dotenv.config({ path: path.resolve("../.env") });

// Get ports from environment - NO fallbacks, will crash if not set
const FRONTEND_PORT = process.env.FRONTEND_PORT;
const BACKEND_PORT = process.env.BACKEND_PORT;

if (!FRONTEND_PORT || !BACKEND_PORT) {
  console.error("❌ FATAL: Required environment variables not set");
  console.error(
    "   Missing:",
    [!FRONTEND_PORT && "FRONTEND_PORT", !BACKEND_PORT && "BACKEND_PORT"]
      .filter(Boolean)
      .join(", ")
  );
  console.error("   Ensure .env file exists at project root with all required variables");
  process.exit(1);
}

// Test user credentials (required for authentication)
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  console.error("❌ FATAL: Test user credentials not set");
  console.error(
    "   Missing:",
    [!TEST_USER_EMAIL && "TEST_USER_EMAIL", !TEST_USER_PASSWORD && "TEST_USER_PASSWORD"]
      .filter(Boolean)
      .join(", ")
  );
  console.error("   Ensure .env file contains TEST_USER_EMAIL and TEST_USER_PASSWORD");
  process.exit(1);
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./src/tests/e2e",
  /* Global setup for logging and initialization */
  globalSetup: "./src/tests/e2e/global-setup.js",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry configuration */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1, // Run sequentially to avoid auth state race conditions
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? "github" : "line", // Use line reporter for minimal output; --quiet flag suppresses stdout
  /* Global timeout for each test */
  timeout: 30000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    /* Always run in headless mode */
    headless: true,
    /* Collect trace only on failure, not retry */
    trace: "retain-on-failure",
    /* Take screenshot on failure */
    screenshot: "only-on-failure",
    /* Disable video recording for faster execution */
    video: "off",
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  /* Environment variables for test helpers (direct API calls, not browser requests) */
  env: {
    E2E_API_BASE_URL: `http://localhost:${BACKEND_PORT}`,
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
  },

  /* Configure projects for major browsers */
  projects: [
    ...(process.env.CI
      ? [
          // CI: All browsers for comprehensive testing across different OS runners
          {
            name: "chromium",
            use: {
              ...devices["Desktop Chrome"],
              // Fix #2: CI-specific Chromium flags to prevent timing issues
              launchOptions: {
                args: [
                  "--disable-background-timer-throttling", // Prevent timer delays
                  "--disable-backgrounding-occluded-windows", // No background throttling
                  "--disable-renderer-backgrounding", // Keep renderer active
                  "--disable-dev-shm-usage", // /dev/shm too small in Docker
                  "--disable-gpu", // No GPU in CI
                  "--no-sandbox", // Docker isolation already sandboxes
                  "--disable-setuid-sandbox",
                ],
              },
            },
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
              deviceScaleFactor: 3,
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
          // Development: Chromium + Firefox for cross-browser testing
          {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
        ]),
  ],
});
