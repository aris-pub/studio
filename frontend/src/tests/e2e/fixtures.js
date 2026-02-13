/**
 * E2E Test Fixtures with API Route Interception
 *
 * ALL E2E tests MUST import from this file (not @playwright/test directly).
 * This ensures test isolation by redirecting API calls to backend-test (SQLite)
 * instead of backend (PostgreSQL dev database).
 *
 * Architecture:
 * - Local dev: Frontend uses backend (port BACKEND_PORT) → PostgreSQL
 * - E2E tests: Route interception redirects to backend-test (port 8001) → SQLite
 * - CI: No interception, uses backend directly for production-like testing
 *
 * CRITICAL: This file uses environment variables with ZERO fallbacks.
 * Tests will crash immediately if required variables are not set.
 */

import { test as base, expect } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env file
dotenv.config({ path: path.resolve("../.env") });

// Get ports from environment - NO fallbacks, will crash if not set
const BACKEND_PORT = process.env.BACKEND_PORT;
const BACKEND_TEST_PORT = process.env.BACKEND_TEST_PORT;
const E2E_BACKEND_PORT = process.env.CI ? BACKEND_PORT : BACKEND_TEST_PORT;

if (!BACKEND_PORT || !BACKEND_TEST_PORT) {
  console.error("❌ FATAL: Required environment variables not set");
  console.error(
    "   Missing:",
    [!BACKEND_PORT && "BACKEND_PORT", !BACKEND_TEST_PORT && "BACKEND_TEST_PORT"]
      .filter(Boolean)
      .join(", ")
  );
  console.error("   Ensure .env file exists at project root with all required variables");
  process.exit(1);
}

/**
 * Extended test fixture with API route interception.
 *
 * In local development (non-CI):
 * - Intercepts all requests to http://localhost:${BACKEND_PORT}/**
 * - Redirects to http://localhost:8001/** (backend-test with SQLite)
 * - Ensures tests don't pollute PostgreSQL dev database
 *
 * In CI:
 * - No interception (E2E_BACKEND_PORT === BACKEND_PORT)
 * - Uses backend directly for production-like testing
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Only intercept in local dev (not CI)
    if (!process.env.CI) {
      const backendUrl = `http://localhost:${BACKEND_PORT}`;
      const testBackendUrl = `http://localhost:${E2E_BACKEND_PORT}`;

      // Intercept all requests to backend and redirect to backend-test
      await page.route(`${backendUrl}/**`, async (route) => {
        const originalUrl = route.request().url();
        const newUrl = originalUrl.replace(backendUrl, testBackendUrl);

        await route.continue({ url: newUrl });
      });
    }

    await use(page);
  },
});

export { expect };
