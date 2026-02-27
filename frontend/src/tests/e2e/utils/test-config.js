/**
 * Test Environment Configuration
 *
 * CRITICAL: Tests run OUTSIDE containers and call backend APIs directly.
 * - VITE_API_BASE_URL: Browser runtime config (frontend uses this)
 * - E2E_API_BASE_URL: Test-time backend URL (tests use this)
 *
 * Both local and CI use the same backend (BACKEND_PORT, PostgreSQL).
 */

/**
 * Get the backend URL for E2E tests
 *
 * @returns {string} Backend API base URL for test environment
 * @throws {Error} If neither E2E_API_BASE_URL nor VITE_API_BASE_URL is set
 */
export function getBackendURL() {
  const url = process.env.E2E_API_BASE_URL || process.env.VITE_API_BASE_URL;

  if (!url) {
    throw new Error(
      "E2E_API_BASE_URL or VITE_API_BASE_URL environment variable not set.\n" +
        "Check playwright.config.js (sets E2E_API_BASE_URL) and global-setup.js."
    );
  }

  return url;
}
