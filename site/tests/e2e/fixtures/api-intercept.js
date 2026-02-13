/**
 * Playwright fixture for automatic API interception
 *
 * This fixture automatically sets up route interception for all tests,
 * redirecting backend API calls to backend-test in local development.
 */

import { test as base } from "@playwright/test";
import { setupApiIntercept } from "../setup/auto-intercept.js";

export const test = base.extend({
  page: async ({ page }, use) => {
    // Setup API interception before each test
    await setupApiIntercept(page);

    // Provide the page to the test
    await use(page);
  },
});

export { expect } from "@playwright/test";
