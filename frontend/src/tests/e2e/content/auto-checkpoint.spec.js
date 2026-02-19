/**
 * @file E2E tests for auto-checkpoint UI behavior
 * @tags @auth @auth-content
 *
 * Auto-checkpoints are created automatically by the backend (YDocClient) when the
 * idle/safety-net heuristics trigger. These tests seed them directly via API to
 * avoid waiting 5+ minutes for the real timers, and verify:
 *
 * 1. Auto-checkpoints appear in the versions list with distinct visual treatment
 * 2. They show a clock icon and "Auto-checkpoint" placeholder
 * 3. They coexist with manual versions in the same list
 * 4. They can be previewed, renamed, and deleted (same operations as manual)
 */

import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";
import { getBackendURL } from "../utils/test-config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(page) {
  return page.evaluate(() => localStorage.getItem("accessToken"));
}

async function createVersion(page, fileId, { versionName = null, checkpointType = "manual" } = {}) {
  const token = await getAccessToken(page);
  const baseURL = getBackendURL();
  const response = await page.request.post(`${baseURL}/files/${fileId}/versions/named`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: { version_name: versionName, checkpoint_type: checkpointType },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create version for file ${fileId}: ${response.status()}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Auto-checkpoint UI @auth", () => {
  let fileId;
  let authHelpers;
  let fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();

    fileId = await fileHelpers.createNewFile();

    await page.goto(`/file/${fileId}`, { waitUntil: "commit" });
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });

    // Open the Versions drawer
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');
    await page.waitForSelector('[data-testid="save-version-button"]', { state: "visible" });
    await page.waitForFunction(
      () => {
        const drawer = document.querySelector(".drawer.active");
        if (!drawer) return false;
        const styles = window.getComputedStyle(drawer);
        return styles.left === "64px" && styles.opacity === "1";
      },
      { timeout: 1000 }
    );
  });

  test.afterEach(async () => {
    if (fileId) {
      await fileHelpers.deleteFile(fileId);
    }
  });

  // -------------------------------------------------------------------------

  test("auto-checkpoint appears in versions list with auto data attribute", async ({ page }) => {
    await createVersion(page, fileId, { checkpointType: "auto" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    const versionItem = page.locator('[data-testid="version-item"]').first();
    await expect(versionItem).toHaveAttribute("data-checkpoint-type", "auto");
  });

  test("auto-checkpoint shows clock icon", async ({ page }) => {
    await createVersion(page, fileId, { checkpointType: "auto" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    const versionItem = page
      .locator('[data-testid="version-item"][data-checkpoint-type="auto"]')
      .first();
    const clockIcon = versionItem.locator(".version-type-icon--auto");
    await expect(clockIcon).toBeVisible();
  });

  test("auto-checkpoint shows Auto-checkpoint placeholder when unnamed", async ({ page }) => {
    await createVersion(page, fileId, { checkpointType: "auto" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    const versionItem = page
      .locator('[data-testid="version-item"][data-checkpoint-type="auto"]')
      .first();

    const itemText = await versionItem.textContent();
    expect(itemText).toContain("Auto-checkpoint");
  });

  test("manual version shows no clock icon", async ({ page }) => {
    await createVersion(page, fileId, { versionName: "My draft", checkpointType: "manual" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    const versionItem = page
      .locator('[data-testid="version-item"][data-checkpoint-type="manual"]')
      .first();
    const clockIcon = versionItem.locator(".version-type-icon--auto");
    await expect(clockIcon).not.toBeVisible();
  });

  test("mixed list shows auto and manual versions with correct attributes", async ({ page }) => {
    // Create manual first, then auto — they appear newest-first
    await createVersion(page, fileId, { versionName: "Named draft", checkpointType: "manual" });
    await createVersion(page, fileId, { checkpointType: "auto" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');
    await page.waitForSelector('[data-testid="save-version-button"]', { state: "visible" });

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    // Should have 2 versions
    const allItems = page.locator('[data-testid="version-item"]');
    await expect(allItems).toHaveCount(2);

    // Newest first = auto (v2), then manual (v1)
    await expect(allItems.nth(0)).toHaveAttribute("data-checkpoint-type", "auto");
    await expect(allItems.nth(1)).toHaveAttribute("data-checkpoint-type", "manual");

    // Manual version should contain its name
    await expect(allItems.nth(1)).toContainText("Named draft");
  });

  test("auto-checkpoint can be opened in preview modal", async ({ page }) => {
    await createVersion(page, fileId, { checkpointType: "auto" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    const versionItem = page.locator('[data-testid="version-item"]').first();
    await versionItem.locator(".version-info").click();

    const modal = page.locator('[data-testid="version-preview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal).toContainText("Version 1");
  });

  test("auto-checkpoint can be renamed", async ({ page }) => {
    await createVersion(page, fileId, { checkpointType: "auto" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    const versionItem = page.locator('[data-testid="version-item"]').first();
    await versionItem.locator('[data-testid="trigger-button"]').click();
    await page.waitForSelector('button:has-text("Rename")');
    await page.click('button:has-text("Rename")');

    const editableInput = versionItem.locator("input, textarea").first();
    await editableInput.fill("Promoted checkpoint");
    await editableInput.press("Enter");

    await expect(versionItem).toContainText("Promoted checkpoint");
  });

  test("auto-checkpoint can be deleted", async ({ page }) => {
    await createVersion(page, fileId, { checkpointType: "auto" });

    await page.reload();
    await page.waitForSelector('[data-testid="workspace-canvas"]', { state: "visible" });
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("Versions") button');

    await page.waitForSelector('[data-testid="version-item"]', { state: "visible" });

    const versionItem = page.locator('[data-testid="version-item"]').first();
    await versionItem.locator('[data-testid="trigger-button"]').click();

    page.once("dialog", (dialog) => dialog.accept());
    await page.click('button:has-text("Delete")');

    const allItems = page.locator('[data-testid="version-item"]');
    await expect(allItems).toHaveCount(0);

    const emptyState = page.locator(".empty-state");
    await expect(emptyState).toBeVisible();
  });
});
