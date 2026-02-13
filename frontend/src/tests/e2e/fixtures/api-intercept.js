/**
 * Playwright fixture for API route interception
 *
 * Redirects all API calls from backend (port 8000) to backend-test (port 8001)
 * for E2E test isolation with SQLite database.
 *
 * This allows:
 * - Manual browser usage → backend (port 8000, PostgreSQL)
 * - E2E tests → backend-test (port 8001, SQLite)
 * - Both using the same frontend container
 */

import { test as base } from "@playwright/test";

// Get backend ports from environment
const BACKEND_PORT = process.env.BACKEND_PORT;
const E2E_BACKEND_PORT = process.env.CI ? BACKEND_PORT : "8001";

export const test = base.extend({
  page: async ({ page }, use) => {
    // Only intercept in local environment (CI uses same backend for production-like testing)
    if (!process.env.CI) {
      // Intercept all requests to backend and redirect to backend-test
      await page.route(`http://localhost:${BACKEND_PORT}/**`, async (route) => {
        const url = route.request().url();
        const newUrl = url.replace(
          `http://localhost:${BACKEND_PORT}`,
          `http://localhost:${E2E_BACKEND_PORT}`
        );

        await route.continue({ url: newUrl });
      });
    }

    // Use the page with interception enabled
    await use(page);
  },
});

export { expect } from "@playwright/test";
