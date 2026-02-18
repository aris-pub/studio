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
    console.log("   Resetting test state...");

    const { execSync } = await import("child_process");

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
      // Apply any pending migrations (no-op if schema is already current)
      execSync(`docker exec ${containerName} alembic upgrade head`, {
        stdio: "ignore",
      });
      console.log("   ✓ Migrations applied");

      // Reset test user and seed stable test files
      console.log("   Creating test user and files...");
      try {
        execSync(`docker exec ${containerName} uv run python scripts/reset_test_user.py`, {
          stdio: "pipe",
        });
        console.log("   ✓ Test user and files created");
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
      console.log("   ⚠ Could not reset test state (container may not be running)");
    }
  }
}
