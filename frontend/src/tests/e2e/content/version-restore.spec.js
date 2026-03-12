/**
 * @file E2E tests for version restore functionality
 * @tags @auth @version-restore
 *
 * Tests the core restore flow: owner restores a named version via the
 * preview modal, content is replaced via Y.js (window.__cmView.dispatch),
 * and all connected clients receive the update.
 *
 * Tests for concurrent-editor detection, read-only lock, and in-progress
 * guard are skipped pending implementation of the useAwareness /
 * useEditor composables (currently stubs).
 */

import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";
import { getBackendURL } from "../utils/test-config.js";
import { getTimeouts } from "../utils/timeout-constants.js";
import { loginUser, createAuthenticatedContext, cleanupYjs } from "../yjs-helpers.js";

test.describe("Version Restore Tests @auth @version-restore", () => {
  let fileId;
  let authHelpers;
  let fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();

    // createNewFile() navigates to /file/{id} automatically
    fileId = await fileHelpers.createNewFile();

    // Open the source drawer and wait for the CM/Y.js editor to be ready
    const timeouts = getTimeouts();
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: timeouts.heavyOperation });
    await page.waitForFunction(() => typeof window.__cmView !== "undefined", null, {
      timeout: timeouts.heavyOperation,
    });

    // Set "original" content via the CM/Y.js API
    await page.evaluate(() => {
      window.__cmView.dispatch({
        changes: {
          from: 0,
          to: window.__cmView.state.doc.length,
          insert: "# Original Content\n\nThis is the first version.",
        },
      });
    });

    // Poll the backend until it reflects the dispatched content (500ms debounce + round-trip).
    // The version snapshot reads the backend's persisted state, so we must wait for it.
    const { accessToken } = await authHelpers.getStoredTokens();
    const backendURL = getBackendURL();
    await expect
      .poll(
        async () => {
          const r = await page.request.get(`${backendURL}/files/${fileId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = await r.json();
          return (data.source ?? "").includes("Original Content");
        },
        { timeout: timeouts.heavyOperation }
      )
      .toBe(true);

    // Open the versions drawer and save a named version
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button');
    await page.waitForSelector('[data-testid="save-version-button"]', { state: "visible" });
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });

    // Exit the auto-opened rename mode so the version row is clickable
    await page.keyboard.press("Escape");

    // Overwrite content to create a "modified" state — __cmView stays mounted
    // even when the versions drawer is in front, so no drawer switch needed
    await page.evaluate(() => {
      window.__cmView.dispatch({
        changes: {
          from: 0,
          to: window.__cmView.state.doc.length,
          insert: "# Modified Content\n\nThis is the second version with changes.",
        },
      });
    });
  });

  test.afterEach(async () => {
    if (fileId) {
      await fileHelpers.deleteFile(fileId).catch(() => {});
    }
  });

  test("owner can restore version", async ({ page }) => {
    // Versions drawer is already open from beforeEach
    await page.locator('[data-testid="version-item"]').first().locator(".version-info").click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });

    // Wait for the version content to finish loading before clicking restore
    await page.waitForSelector(".loading-state", { state: "hidden", timeout: 5000 });

    await page.click('[data-testid="restore-version-button"]');
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
    await page.click('[data-testid="confirm-restore-button"]');

    // Modal closes when restore succeeds
    await expect(page.locator('[data-testid="version-preview-modal"]')).not.toBeVisible({
      timeout: 5000,
    });

    // Content is replaced via __cmView.dispatch (synchronous, no Y.js propagation delay)
    const content = await page.evaluate(() => window.__cmView?.state.doc.toString());
    expect(content).toContain("Original Content");
    expect(content).not.toContain("Modified Content");
  });

  test("non-owner cannot restore version", async ({ browser, request }) => {
    test.setTimeout(60000);

    const backendURL = getBackendURL();

    // Register + login a second user
    await request
      .post(`${backendURL}/register`, {
        data: {
          email: "versiontest2@example.com",
          name: "Version Test User 2",
          initials: "VT2",
          password: "testpass123",
        },
      })
      .catch(() => {});
    const editorAuth = await loginUser(request, "versiontest2@example.com", "testpass123");

    // Share the file (created by owner in beforeEach) with the second user as EDITOR
    const { accessToken } = await authHelpers.getStoredTokens();
    const permResponse = await request.post(`${backendURL}/files/${fileId}/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      data: { user_id: editorAuth.userData.id, role: "EDITOR" },
    });
    if (!permResponse.ok() && permResponse.status() !== 400) {
      throw new Error(`Failed to add collaborator: ${permResponse.status()}`);
    }

    // Open the file as the editor in a separate browser context
    const editor = await createAuthenticatedContext(browser, editorAuth);
    try {
      await editor.page.goto(`/file/${fileId}`, { waitUntil: "commit" });
      await editor.page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 });

      // Open versions drawer
      await editor.page.click(
        '[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button'
      );
      await editor.page.waitForSelector('[data-testid="version-item"]', { timeout: 10000 });

      // Open the version preview modal (no Escape needed — editor didn't trigger rename mode)
      await editor.page
        .locator('[data-testid="version-item"]')
        .first()
        .locator(".version-info")
        .click();
      await editor.page.waitForSelector('[data-testid="version-preview-modal"]', {
        timeout: 10000,
      });
      await editor.page.waitForSelector(".loading-state", { state: "hidden", timeout: 5000 });

      // Restore button should NOT be visible for non-owner
      await expect(editor.page.locator('[data-testid="restore-version-button"]')).not.toBeVisible();

      // "Owner only" message should be shown instead
      await expect(editor.page.locator(".owner-only-note")).toBeVisible();
      await expect(editor.page.locator(".owner-only-note")).toContainText("owner");
    } finally {
      await cleanupYjs(editor.page).catch(() => {});
      await editor.context.close();
    }
  });

  test("concurrent editor detection shows warning", async () => {
    // Requires useAwareness composable (currently a stub that throws).
    // Implement once useAwareness is wired to the Y.js provider.
    test.skip();
  });

  test("editor is read-only during restore", async () => {
    // Requires useEditor composable (currently a stub that throws).
    // The read-only lock feature will be enabled when useEditor is implemented.
    test.skip();
  });

  test("all connected clients see restored content", async ({ page, context }) => {
    test.setTimeout(90000); // Y.js propagation across two tabs in CI
    const timeouts = getTimeouts();

    // Open a second tab and get it to the same file with the source editor ready
    const page2 = await context.newPage();
    await page2.goto(`/file/${fileId}`, { waitUntil: "commit" });
    await page2.waitForLoadState("domcontentloaded");
    // Open source drawer on page2 so __cmView is initialized there too
    await page2.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page2.waitForSelector(".cm-editor", { timeout: timeouts.heavyOperation });
    await page2.waitForFunction(
      () => typeof window.__cmView !== "undefined",
      {},
      { timeout: timeouts.heavyOperation }
    );
    // Wait for Y.js provider to sync on page2 before restoring
    await page2.waitForFunction(
      () => window.__provider?.synced === true,
      {},
      { timeout: timeouts.heavyOperation }
    );

    // page1: restore the version
    await page.locator('[data-testid="version-item"]').first().locator(".version-info").click();
    await page.waitForSelector('[data-testid="version-preview-modal"]', {
      timeout: timeouts.heavyOperation,
    });
    await page.waitForSelector(".loading-state", {
      state: "hidden",
      timeout: timeouts.heavyOperation,
    });
    await page.click('[data-testid="restore-version-button"]');
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
    await page.click('[data-testid="confirm-restore-button"]');
    await expect(page.locator('[data-testid="version-preview-modal"]')).not.toBeVisible({
      timeout: timeouts.heavyOperation,
    });

    // Wait for Y.js to propagate the restoration to page2
    await page2.waitForFunction(
      () => window.__cmView?.state.doc.toString().includes("Original Content"),
      null,
      { timeout: timeouts.heavyOperation }
    );

    const content2 = await page2.evaluate(() => window.__cmView.state.doc.toString());
    expect(content2).toContain("Original Content");
    expect(content2).not.toContain("Modified Content");

    await page2.close();
  });

  test("cannot restore while another restore is in progress", async () => {
    // The current dispatch-based restore is synchronous, so isRestoring flips
    // true→false within a single microtask — no observable window to assert.
    // Implement once restore becomes async (e.g., awaiting backend persistence).
    test.skip();
  });
});
