/**
 * Shared authentication setup for E2E tests
 *
 * This module provides optimized authentication patterns that eliminate
 * redundant auth clearing and use storage state for sharing auth across tests.
 */

import { AuthHelpers } from "./auth-helpers.js";
import path from "path";

const AUTH_STATE_PATH = path.join(process.cwd(), "auth-state.json");

/**
 * Setup for shared authentication across test file
 * Use this pattern in test files to avoid redundant auth clearing
 */
export async function setupSharedAuth(page) {
  const authHelpers = new AuthHelpers(page);

  // Only authenticate once at the start
  await authHelpers.ensureLoggedIn(true); // Skip DOM verification for speed

  // Save auth state for potential reuse
  try {
    await authHelpers.saveAuthState(AUTH_STATE_PATH);
  } catch (error) {
    // Ignore save errors - not critical
  }

  return authHelpers;
}

/**
 * Fast auth verification for beforeEach hooks
 * Use this instead of full ensureLoggedIn in beforeEach
 */
export async function verifyAuthInBeforeEach(page) {
  const authHelpers = new AuthHelpers(page);

  // Quick verification - no page loads or redirects
  const isAuthenticated = await authHelpers.verifyLoggedIn();

  if (!isAuthenticated) {
    await authHelpers.ensureLoggedIn(true); // Fast re-auth if needed
  }

  return authHelpers;
}

/**
 * Create authenticated browser context using storage state
 * Use this in playwright.config.js or test setup for fastest auth
 */
export async function createAuthenticatedContext(browser, baseURL) {
  try {
    // Try to load existing auth state
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      baseURL,
    });

    // Verify the loaded state is still valid
    const page = await context.newPage();
    const authHelpers = new AuthHelpers(page);

    if (await authHelpers.verifyLoggedIn()) {
      return { context, authHelpers };
    } else {
      await context.close();
    }
  } catch (_error) {
    // Ignore errors loading saved state
  }

  // Create new authenticated context
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const authHelpers = new AuthHelpers(page);

  // Authenticate and save state
  await authHelpers.ensureLoggedIn(true);
  await authHelpers.saveAuthState(AUTH_STATE_PATH);

  return { context, authHelpers };
}

/**
 * Example usage patterns for test files:
 *
 * PATTERN 1: Shared auth across entire test file (fastest)
 * ```javascript
 * test.describe('My Tests', () => {
 *   let authHelpers;
 *
 *   test.beforeAll(async ({ page }) => {
 *     authHelpers = await setupSharedAuth(page);
 *   });
 *
 *   test.beforeEach(async ({ page }) => {
 *     // Lightweight verification only
 *     authHelpers = await verifyAuthInBeforeEach(page);
 *   });
 *
 *   test('my test', async ({ page }) => {
 *     // Test logic - already authenticated
 *   });
 * });
 * ```
 *
 * PATTERN 2: Storage state context (for parallel execution)
 * ```javascript
 * test.describe('My Tests', () => {
 *   test.beforeEach(async ({ page }) => {
 *     // Context already authenticated via storage state
 *     // No auth setup needed!
 *   });
 * });
 * ```
 */
