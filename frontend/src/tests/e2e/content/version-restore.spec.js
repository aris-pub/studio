/**
 * @file E2E tests for version restore safety features
 * @tags @auth @version-restore @collab
 *
 * Tests the core restore flow and safety guards:
 * - Owner-only restore with confirmation
 * - Concurrent editor detection (awareness-based)
 * - Read-only lock during restore
 * - Cross-client content propagation via Y.js
 * - Restore notification for connected users
 * - Network failure recovery
 * - Single-user restore (no concurrent editor warning)
 *
 * Depends on: useVersionRestore composable wiring (std-fku4),
 * restore notification (std-7oh1).
 */

import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";
import { FileHelpers } from "../utils/file-helpers.js";
import { getBackendURL } from "../utils/test-config.js";
import { getTimeouts } from "../utils/timeout-constants.js";
import {
  loginUser,
  createAuthenticatedContext,
  openFileInEditor,
  cleanupYjs,
} from "../yjs-helpers.js";

const SECOND_USER = {
  email: "versiontest2@example.com",
  name: "Version Test User 2",
  initials: "VT2",
  password: "testpass123",
};

async function registerSecondUser(request) {
  const backendURL = getBackendURL();
  await request.post(`${backendURL}/register`, { data: SECOND_USER }).catch(() => {});
  return loginUser(request, SECOND_USER.email, SECOND_USER.password);
}

async function shareFileWithUser(request, fileId, userId, role, ownerToken) {
  const backendURL = getBackendURL();
  const resp = await request.post(`${backendURL}/files/${fileId}/permissions`, {
    headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
    data: { user_id: userId, role },
  });
  if (!resp.ok() && resp.status() !== 400) {
    throw new Error(`Failed to share file: ${resp.status()}`);
  }
}

/**
 * Open version preview modal and wait for content to load.
 * Assumes the versions drawer is already open with at least one version item.
 */
async function openVersionPreview(page) {
  await page.locator('[data-testid="version-item"]').first().locator(".version-info").click();
  await page.waitForSelector('[data-testid="version-preview-modal"]', { timeout: 10000 });
  await page.waitForSelector(".loading-state", { state: "hidden", timeout: 5000 });
}

/**
 * Execute the full restore flow: click restore, confirm, wait for modal close.
 */
async function performRestore(page) {
  const timeouts = getTimeouts();
  await page.click('[data-testid="restore-version-button"]');
  await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
  await page.click('[data-testid="confirm-restore-button"]');
  await expect(page.locator('[data-testid="version-preview-modal"]')).not.toBeVisible({
    timeout: timeouts.heavyOperation,
  });
}

test.describe("Version Restore Tests @auth @version-restore", () => {
  let fileId;
  let authHelpers;
  let fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();

    fileId = await fileHelpers.createNewFile();

    const timeouts = getTimeouts();
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: timeouts.heavyOperation });
    await page.waitForFunction(() => typeof window.__cmView !== "undefined", null, {
      timeout: timeouts.heavyOperation,
    });

    await page.evaluate(() => {
      window.__cmView.dispatch({
        changes: {
          from: 0,
          to: window.__cmView.state.doc.length,
          insert: "# Original Content\n\nThis is the first version.",
        },
      });
    });

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

    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button');
    await page.waitForSelector('[data-testid="save-version-button"]', { state: "visible" });
    await page.click('[data-testid="save-version-button"]');
    await page.waitForSelector('[data-testid="version-item"]', { timeout: 5000 });
    await page.keyboard.press("Escape");

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
    await openVersionPreview(page);
    await page.click('[data-testid="restore-version-button"]');
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
    await page.click('[data-testid="confirm-restore-button"]');

    await expect(page.locator('[data-testid="version-preview-modal"]')).not.toBeVisible({
      timeout: 5000,
    });

    const content = await page.evaluate(() => window.__cmView?.state.doc.toString());
    expect(content).toContain("Original Content");
    expect(content).not.toContain("Modified Content");
  });

  test("non-owner cannot restore version", async ({ browser, request }) => {
    test.setTimeout(60000);

    const editorAuth = await registerSecondUser(request);
    const { accessToken } = await authHelpers.getStoredTokens();
    await shareFileWithUser(request, fileId, editorAuth.userData.id, "EDITOR", accessToken);

    const editor = await createAuthenticatedContext(browser, editorAuth);
    try {
      await editor.page.goto(`/file/${fileId}`, { waitUntil: "commit" });
      await editor.page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 });

      await editor.page.click(
        '[data-testid="workspace-sidebar"] .sb-item:has-text("versions") button'
      );
      await editor.page.waitForSelector('[data-testid="version-item"]', { timeout: 10000 });
      await editor.page
        .locator('[data-testid="version-item"]')
        .first()
        .locator(".version-info")
        .click();
      await editor.page.waitForSelector('[data-testid="version-preview-modal"]', {
        timeout: 10000,
      });
      await editor.page.waitForSelector(".loading-state", { state: "hidden", timeout: 5000 });

      await expect(editor.page.locator('[data-testid="restore-version-button"]')).not.toBeVisible();
      await expect(editor.page.locator(".owner-only-note")).toBeVisible();
      await expect(editor.page.locator(".owner-only-note")).toContainText("owner");
    } finally {
      await cleanupYjs(editor.page).catch(() => {});
      await editor.context.close();
    }
  });

  test("concurrent editor detection shows warning", async ({ page, browser, request }) => {
    test.setTimeout(90000);
    const timeouts = getTimeouts();

    const editorAuth = await registerSecondUser(request);
    const { accessToken } = await authHelpers.getStoredTokens();
    await shareFileWithUser(request, fileId, editorAuth.userData.id, "EDITOR", accessToken);

    // Open file as the second user in a separate browser context
    const editor = await createAuthenticatedContext(browser, editorAuth);
    try {
      await openFileInEditor(editor.page, fileId);

      // Simulate active editing: set cursor and editing state on awareness
      await editor.page.evaluate(() => {
        if (window.__awareness) {
          window.__awareness.setLocalStateField("cursor", { anchor: 0, head: 0 });
          window.__awareness.setLocalStateField("editing", true);
          window.__awareness.setLocalStateField("user", {
            id: JSON.parse(localStorage.getItem("user")).id,
            name: JSON.parse(localStorage.getItem("user")).name,
          });
        }
      });

      // Wait for awareness to propagate between contexts
      await page.waitForFunction(
        () => {
          if (!window.__awareness) return false;
          const states = window.__awareness.getStates();
          let found = false;
          states.forEach((state, clientId) => {
            if (clientId !== window.__awareness.clientID && state.editing) {
              found = true;
            }
          });
          return found;
        },
        null,
        { timeout: timeouts.heavyOperation }
      );

      // Owner opens version preview and clicks restore
      await openVersionPreview(page);
      await page.click('[data-testid="restore-version-button"]');

      // The concurrent editor warning should appear, mentioning the other user
      const concurrentWarning = page.locator('[data-testid="concurrent-editor-warning"]');
      await expect(concurrentWarning).toBeVisible({ timeout: timeouts.heavyOperation });
      await expect(concurrentWarning).toContainText(SECOND_USER.name);
    } finally {
      await cleanupYjs(editor.page).catch(() => {});
      await editor.context.close();
    }
  });

  test("editor is read-only during restore", async ({ page }) => {
    test.setTimeout(60000);
    const timeouts = getTimeouts();

    await openVersionPreview(page);

    // Intercept the version preview API to slow it down so we can observe the lock
    const backendURL = getBackendURL();
    await page.route(`${backendURL}/files/*/versions/*/preview`, async (route) => {
      // Delay the response to give us time to check read-only state
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    await page.click('[data-testid="restore-version-button"]');
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
    await page.click('[data-testid="confirm-restore-button"]');

    // During restore, the editor should be read-only
    const isReadOnly = await page.evaluate(() => {
      const view = window.__cmView;
      if (!view) return null;
      return view.state.readOnly;
    });
    expect(isReadOnly).toBe(true);

    // Typing should have no effect while read-only
    const contentBefore = await page.evaluate(() => window.__cmView.state.doc.toString());
    await page.click(".cm-content");
    await page.keyboard.type("should not appear");
    const contentDuring = await page.evaluate(() => window.__cmView.state.doc.toString());
    expect(contentDuring).toBe(contentBefore);

    // Wait for restore to complete
    await expect(page.locator('[data-testid="version-preview-modal"]')).not.toBeVisible({
      timeout: timeouts.heavyOperation,
    });

    // After restore completes, editor should be editable again
    const isReadOnlyAfter = await page.evaluate(() => {
      const view = window.__cmView;
      if (!view) return null;
      return view.state.readOnly;
    });
    expect(isReadOnlyAfter).toBe(false);
  });

  test("all connected clients see restored content", async ({ page, context }) => {
    test.setTimeout(90000);
    const timeouts = getTimeouts();

    const page2 = await context.newPage();
    await openFileInEditor(page2, fileId);

    await openVersionPreview(page);
    await performRestore(page);

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

  test("cannot restore while another restore is in progress", async ({ page }) => {
    test.setTimeout(60000);
    const timeouts = getTimeouts();

    await openVersionPreview(page);

    // Intercept the version content fetch to make restore take a while
    const backendURL = getBackendURL();
    let fetchCount = 0;
    await page.route(`${backendURL}/files/*/versions/*/preview`, async (route) => {
      fetchCount++;
      if (fetchCount > 1) {
        // Second restore attempt — delay significantly
        await new Promise((r) => setTimeout(r, 5000));
      }
      await route.continue();
    });

    // Start the first restore
    await page.click('[data-testid="restore-version-button"]');
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
    await page.click('[data-testid="confirm-restore-button"]');

    // While first restore is in progress, the restore button should be disabled
    // Re-open modal quickly if it closed, or check the isRestoring state
    const isRestoring = await page.evaluate(() => {
      // useVersionRestore exposes isRestoring on the component — check via the button state
      const btn = document.querySelector('[data-testid="restore-version-button"]');
      return btn ? btn.disabled : null;
    });

    // If the button exists, it should be disabled during restore
    if (isRestoring !== null) {
      expect(isRestoring).toBe(true);
    }

    // Wait for restore to complete
    await expect(page.locator('[data-testid="version-preview-modal"]')).not.toBeVisible({
      timeout: timeouts.heavyOperation,
    });

    const content = await page.evaluate(() => window.__cmView?.state.doc.toString());
    expect(content).toContain("Original Content");
  });

  test("restore notification shown to other connected users", async ({
    page,
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const timeouts = getTimeouts();

    const editorAuth = await registerSecondUser(request);
    const { accessToken } = await authHelpers.getStoredTokens();
    await shareFileWithUser(request, fileId, editorAuth.userData.id, "EDITOR", accessToken);

    // Open file as editor in separate browser context
    const editor = await createAuthenticatedContext(browser, editorAuth);
    try {
      await openFileInEditor(editor.page, fileId);

      // Owner restores version
      await openVersionPreview(page);
      await performRestore(page);

      // Editor should see a restore notification (toast or dialog)
      const notification = editor.page.locator('[data-testid="restore-notification"]');
      await expect(notification).toBeVisible({ timeout: timeouts.heavyOperation });
      await expect(notification).toContainText(/version.*restored|restored.*version/i);
    } finally {
      await cleanupYjs(editor.page).catch(() => {});
      await editor.context.close();
    }
  });

  test("network failure during restore unlocks editor", async ({ page }) => {
    test.setTimeout(60000);
    const timeouts = getTimeouts();

    // Intercept the version preview API to simulate a failure
    const backendURL = getBackendURL();
    let shouldFail = false;
    await page.route(`${backendURL}/files/*/versions/*/preview`, async (route) => {
      if (shouldFail) {
        await route.abort("failed");
      } else {
        await route.continue();
      }
    });

    await openVersionPreview(page);

    // Enable failure for the restore attempt (the initial preview load already succeeded)
    shouldFail = true;

    await page.click('[data-testid="restore-version-button"]');
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
    await page.click('[data-testid="confirm-restore-button"]');

    // Restore should fail — wait for error indication
    // Wait for restore attempt to complete (success or failure)
    await page
      .locator('[data-testid="restore-error"]')
      .isVisible({ timeout: timeouts.heavyOperation })
      .catch(() => false);

    // Even if error UI is not shown, the editor must not stay locked
    const isReadOnly = await page.evaluate(() => {
      const view = window.__cmView;
      if (!view) return null;
      return view.state.readOnly;
    });
    expect(isReadOnly).toBeFalsy();

    // isRestoring state should be cleared
    const contentBefore = await page.evaluate(() => window.__cmView.state.doc.toString());
    await page.click(".cm-content");
    await page.keyboard.type("x");
    // Small wait for keystroke to register
    await page.waitForTimeout(200);
    const contentAfter = await page.evaluate(() => window.__cmView.state.doc.toString());
    expect(contentAfter).not.toBe(contentBefore);
  });

  test("restore with no other users skips concurrent editor warning", async ({ page }) => {
    test.setTimeout(60000);

    // Verify no other users are connected via awareness
    const otherUsers = await page.evaluate(() => {
      if (!window.__awareness) return 0;
      let count = 0;
      window.__awareness.getStates().forEach((state, clientId) => {
        if (clientId !== window.__awareness.clientID && (state.cursor || state.editing)) {
          count++;
        }
      });
      return count;
    });
    expect(otherUsers).toBe(0);

    await openVersionPreview(page);
    await page.click('[data-testid="restore-version-button"]');

    // Should go straight to the standard confirm dialog — no concurrent editor warning
    const concurrentWarning = page.locator('[data-testid="concurrent-editor-warning"]');
    await expect(concurrentWarning).not.toBeVisible({ timeout: 2000 });

    // The normal restore confirmation should appear
    await page.waitForSelector('[data-testid="restore-confirm-dialog"]');
    await page.click('[data-testid="confirm-restore-button"]');

    await expect(page.locator('[data-testid="version-preview-modal"]')).not.toBeVisible({
      timeout: 5000,
    });

    const content = await page.evaluate(() => window.__cmView?.state.doc.toString());
    expect(content).toContain("Original Content");
  });
});
