/**
 * Global setup for site E2E tests
 *
 * Configures API route interception to redirect requests from backend to backend-test
 * for SQLite-based test isolation.
 */

// Get backend ports from environment
const BACKEND_PORT = process.env.BACKEND_PORT;
const E2E_BACKEND_PORT = process.env.CI ? BACKEND_PORT : "8001";

export default async function globalSetup() {
  // Set E2E_API_BASE_URL for test helpers
  process.env.E2E_API_BASE_URL = `http://localhost:${E2E_BACKEND_PORT}`;

  console.log("🔧 Site E2E Global Setup");
  console.log(`   Backend (dev): http://localhost:${BACKEND_PORT}`);
  console.log(`   Backend (test): http://localhost:${E2E_BACKEND_PORT}`);
  console.log(`   E2E_API_BASE_URL: ${process.env.E2E_API_BASE_URL}`);

  if (process.env.CI) {
    console.log("   Mode: CI - using backend service (PostgreSQL)");
  } else {
    console.log("   Mode: Local - intercepting to backend-test (SQLite)");
    console.log("   Cleaning SQLite database for fresh test run...");

    // Clean SQLite database before each test run
    const { execSync } = await import("child_process");
    const { basename, dirname } = await import("path");

    // Get project name from parent directory (tests run from frontend/ or site/ subdirectory)
    const projectName = process.env.COMPOSE_PROJECT_NAME || basename(dirname(process.cwd()));
    const containerName = `${projectName}-backend-test-1`;

    try {
      execSync(
        `docker exec ${containerName} rm -f test_e2e.db && docker restart ${containerName}`,
        {
          stdio: "ignore",
        }
      );
      console.log("   ✓ Database cleaned and backend-test restarting...");

      // Wait for backend-test to be ready (poll health endpoint)
      console.log("   Waiting for backend-test to be ready...");
      const maxAttempts = 60; // 60 attempts * 500ms = 30 seconds max
      let attempt = 0;
      let ready = false;

      while (attempt < maxAttempts && !ready) {
        try {
          const response = await fetch(`http://localhost:${E2E_BACKEND_PORT}/health`);
          if (response.ok) {
            ready = true;
            console.log("   ✓ Backend-test ready");
          }
        } catch (_error) {
          // Backend not ready yet, wait and retry
        }

        if (!ready) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          attempt++;
        }
      }

      if (!ready) {
        console.log("   ⚠ Backend-test did not become ready within 30 seconds");
      }
    } catch (_error) {
      console.log("   ⚠ Could not clean database (container may not be running)");
    }
  }
}
