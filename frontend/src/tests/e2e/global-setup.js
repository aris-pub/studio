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

    // Find the actual backend-test container name (project name varies based on where compose file is)
    const containerListOutput = execSync(
      'docker ps --filter "name=backend-test" --format "{{.Names}}"',
      {
        encoding: "utf-8",
      }
    ).trim();
    const containerName = containerListOutput.split("\n")[0];

    if (!containerName) {
      throw new Error("backend-test container not found. Make sure docker compose is running.");
    }

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

      // Fix database permissions (migrations run as root, app runs as different user)
      execSync(`docker exec ${containerName} chmod 666 test_e2e.db`, {
        stdio: "ignore",
      });
      console.log("   ✓ Database permissions fixed");

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
          // If user already exists, that's fine - we can use it for tests
          if (errorText.includes("already registered")) {
            console.log(`   ✓ Test user already exists (${testEmail})`);
          } else {
            console.log(`   ⚠ Test user creation failed: ${errorText}`);
          }
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
