/**
 * E2E Test Fixtures
 *
 * Wraps page.goto() and page.waitForURL() to default to "domcontentloaded"
 * instead of "load". Vite's HMR websocket keeps the "load" event from firing,
 * causing bare page.goto() and waitForURL() to hang until timeout.
 */

import { test as base, expect, devices } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);
    page.goto = (url, options = {}) => {
      return originalGoto(url, { waitUntil: "domcontentloaded", ...options });
    };

    const originalWaitForURL = page.waitForURL.bind(page);
    page.waitForURL = (url, options = {}) => {
      return originalWaitForURL(url, { waitUntil: "domcontentloaded", ...options });
    };

    await use(page);
  },
});

export { expect, devices };
