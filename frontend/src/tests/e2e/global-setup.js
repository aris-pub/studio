/**
 * Global setup for E2E tests
 *
 * Cleans SQLite database and waits for backend-test to be ready.
 */

// Get backend ports from environment
const BACKEND_PORT = process.env.BACKEND_PORT;
const BACKEND_TEST_PORT = process.env.BACKEND_TEST_PORT;
const E2E_BACKEND_PORT = process.env.CI ? BACKEND_PORT : BACKEND_TEST_PORT;

export default async function globalSetup() {
  // Set E2E_API_BASE_URL for test helpers
  process.env.E2E_API_BASE_URL = `http://localhost:${E2E_BACKEND_PORT}`;

  console.log("🔧 E2E Global Setup");
  console.log(`   Backend (dev): http://localhost:${BACKEND_PORT}`);
  console.log(`   Backend (test): http://localhost:${E2E_BACKEND_PORT}`);
  console.log(`   E2E_API_BASE_URL: ${process.env.E2E_API_BASE_URL}`);

  if (process.env.CI) {
    console.log("   Mode: CI - using backend service (PostgreSQL)");
  } else {
    console.log("   Mode: Local - using backend-test (SQLite)");
    console.log("   Cleaning SQLite database for fresh test run...");

    // Clean SQLite database before each test run (no container restart needed)
    const { execSync } = await import("child_process");
    const { basename, dirname } = await import("path");

    // Get project name from parent directory (tests run from frontend/ or site/ subdirectory)
    const projectName = process.env.COMPOSE_PROJECT_NAME || basename(dirname(process.cwd()));
    const containerName = `${projectName}-backend-test-1`;

    try {
      // Clean the database file and run migrations
      execSync(`docker exec ${containerName} rm -f test_e2e.db`, {
        stdio: "ignore",
      });
      console.log("   ✓ Database cleaned");

      // Run migrations to create tables
      execSync(`docker exec ${containerName} alembic upgrade head`, {
        stdio: "ignore",
      });
      console.log("   ✓ Migrations applied");

      // Create test user
      const testEmail = process.env.TEST_USER_EMAIL || "testuser@aris.pub";
      const testPassword = process.env.TEST_USER_PASSWORD || "testpassword123";

      try {
        const response = await fetch(`http://localhost:${E2E_BACKEND_PORT}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            name: "Test User",
          }),
        });

        if (response.ok) {
          console.log(`   ✓ Test user created (${testEmail})`);
        } else {
          const errorText = await response.text();
          console.log(`   ⚠ Test user creation failed: ${errorText}`);
        }
      } catch (error) {
        console.log(`   ⚠ Test user creation failed: ${error.message}`);
      }

      // Quick health check (backend-test should already be running)
      try {
        const response = await fetch(`http://localhost:${E2E_BACKEND_PORT}/health`);
        if (response.ok) {
          console.log("   ✓ Backend-test ready");
        }
      } catch (_error) {
        console.log("   ⚠ Backend-test health check failed (may need to start container)");
      }
    } catch (_error) {
      console.log("   ⚠ Could not clean database (container may not be running)");
    }
  }
}
