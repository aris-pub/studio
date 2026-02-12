/**
 * Auto-setup script for API interception
 *
 * This file runs as a setup project dependency to configure
 * route interception for all E2E tests.
 */

import { test as setup } from "@playwright/test";

const BACKEND_PORT = process.env.BACKEND_PORT;
const E2E_BACKEND_PORT = process.env.CI ? BACKEND_PORT : "8001";

// This setup runs once before all tests
setup("configure API interception", async () => {
  // Configuration only - actual interception happens per-test via fixture
  console.log(`API interception: ${BACKEND_PORT} → ${E2E_BACKEND_PORT}`);
});

// Export the interception function for use in fixtures
export async function setupApiIntercept(page) {
  if (!process.env.CI) {
    await page.route(`http://localhost:${BACKEND_PORT}/**`, async (route) => {
      const url = route.request().url();
      const newUrl = url.replace(
        `http://localhost:${BACKEND_PORT}`,
        `http://localhost:${E2E_BACKEND_PORT}`
      );

      await route.continue({ url: newUrl });
    });
  }
}
