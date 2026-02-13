/**
 * Global test hooks
 *
 * This file is auto-discovered by Playwright and runs for all tests.
 * Filename pattern *.setup.js in testDir triggers automatic execution.
 */

import { test } from "@playwright/test";
import { setupApiIntercept } from "./setup/auto-intercept.js";

// Apply API interception to every test
test.beforeEach(async ({ page }) => {
  await setupApiIntercept(page);
});
