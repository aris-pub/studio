/**
 * Global setup for E2E tests
 *
 * Resets test user via the backend and waits for it to be ready.
 * Both local and CI use the same backend (BACKEND_PORT).
 */

const BACKEND_PORT = process.env.BACKEND_PORT;

export default async function globalSetup() {
  process.env.E2E_API_BASE_URL = `http://localhost:${BACKEND_PORT}`;

  console.log("🔧 E2E Global Setup");
  console.log(`   Backend: http://localhost:${BACKEND_PORT}`);
  console.log(`   E2E_API_BASE_URL: ${process.env.E2E_API_BASE_URL}`);

  const { execSync } = await import("child_process");

  // Find the backend container
  const containerListOutput = execSync(
    'docker ps --filter "name=backend" --filter "name=-backend-" --format "{{.Names}}"',
    { encoding: "utf-8" }
  ).trim();

  // Pick the main backend container (not backend-test)
  const containers = containerListOutput.split("\n").filter(Boolean);
  const containerName = containers.find(
    (name) => !name.includes("backend-test") && name.includes("backend")
  );

  if (!containerName) {
    console.log("   ⚠ Backend container not found — skipping test user reset");
    console.log("     (Tests will use existing DB state)");
  } else {
    try {
      console.log(`   Using container: ${containerName}`);
      execSync(`docker exec ${containerName} uv run python scripts/reset_test_user.py`, {
        stdio: "pipe",
      });
      console.log("   ✓ Test user and files reset");
    } catch (error) {
      console.log(`   ⚠ Test user reset failed: ${error.message}`);
    }
  }

  // Health check
  try {
    const response = await fetch(`http://localhost:${BACKEND_PORT}/health`);
    if (response.ok) {
      console.log("   ✓ Backend ready");
    }
  } catch (_error) {
    console.log("   ⚠ Backend health check failed");
  }
}
