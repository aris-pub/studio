/**
 * @file E2E tests for real-time annotation sync via Y.js
 * @tags @auth @annotations @realtime
 *
 * Tests that annotation changes propagate in real-time to other
 * collaborators via Y.js signaling, without requiring a page refresh.
 */

import { test, expect } from "../fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
} from "../yjs-helpers.js";
import { getBackendURL } from "../utils/test-config.js";

const backendURL = getBackendURL();

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

const COLLAB_EMAIL = "realtime-collab@example.com";
const COLLAB_PASSWORD = "testpass123";
const COLLAB_NAME = "Realtime Collaborator";
const COLLAB_INITIALS = "RC";

async function registerUser(request, email, name, initials, password) {
  const response = await request.post(`${backendURL}/register`, {
    data: { email, name, initials, password },
  });
  if (!response.ok()) {
    const body = await response.text();
    if (response.status() === 409 || body.includes("already")) return null;
    throw new Error(`Registration failed: ${response.status()} ${body}`);
  }
  return await response.json();
}

async function addCollaborator(fileId, userId, role, token) {
  const response = await fetch(`${backendURL}/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, role }),
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 400 && body.includes("already has permission")) return null;
    throw new Error(`Failed to add collaborator: ${response.status} - ${body}`);
  }
  return await response.json();
}

async function openFileInViewer(page, fileId) {
  await page.goto(`/file/${fileId}`, { waitUntil: "commit" });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 });
}

test.describe("Real-time Annotation Sync @auth @annotations @realtime", () => {
  let ownerAuth, collabAuth;
  let fileId;

  test.beforeAll(async ({ request }) => {
    await registerUser(request, COLLAB_EMAIL, COLLAB_NAME, COLLAB_INITIALS, COLLAB_PASSWORD);
    [ownerAuth, collabAuth] = await Promise.all([
      loginUser(request, TEST_USER_EMAIL, TEST_USER_PASSWORD),
      loginUser(request, COLLAB_EMAIL, COLLAB_PASSWORD),
    ]);
  });

  test.beforeEach(async ({ request }) => {
    fileId = await createTestFile(
      request,
      ownerAuth.token,
      ownerAuth.userData.id,
      "# Realtime Test\n\nThis is a paragraph with text for annotation sync testing."
    );
    await addCollaborator(fileId, collabAuth.userData.id, "EDITOR", ownerAuth.token);
  });

  test.afterEach(async ({ request }) => {
    if (fileId) await deleteTestFile(request, ownerAuth.token, fileId).catch(() => {});
  });

  test("shared annotation created by owner appears on collaborator without refresh", async ({
    request,
    browser,
  }) => {
    test.setTimeout(60000);

    // Both users open the same file
    const owner = await createAuthenticatedContext(browser, ownerAuth);
    const collab = await createAuthenticatedContext(browser, collabAuth);

    try {
      await Promise.all([
        openFileInViewer(owner.page, fileId),
        openFileInViewer(collab.page, fileId),
      ]);

      // Wait for pages to fully load (manuscript container visible)
      await Promise.all([
        owner.page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 }),
        collab.page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 }),
      ]);

      // Owner creates a shared annotation via API
      const annResponse = await request.post(`${backendURL}/annotations/`, {
        headers: { Authorization: `Bearer ${ownerAuth.token}` },
        data: {
          file_id: fileId,
          color: "purple",
          anchor_data: { node_id: "test-node", start_offset: 0, end_offset: 10 },
          selected_text: "realtime highlight",
          visibility: "shared",
        },
      });
      const annotation = await annResponse.json();

      // Owner bumps the Y.js annotation version to trigger sync
      await owner.page.evaluate(() => {
        const ydoc = window.__ydoc;
        if (ydoc) {
          const meta = ydoc.getMap("annotations-meta");
          meta.set("version", Date.now());
        }
      });

      // Collaborator should see the annotation appear without refreshing
      await expect(
        collab.page.locator(`[data-card-id="${annotation.id}"]`)
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await owner.context.close();
      await collab.context.close();
    }
  });

  test("annotation deleted by owner disappears from collaborator view", async ({
    request,
    browser,
  }) => {
    test.setTimeout(60000);

    // Create annotation first
    const annResponse = await request.post(`${backendURL}/annotations/`, {
      headers: { Authorization: `Bearer ${ownerAuth.token}` },
      data: {
        file_id: fileId,
        color: "blue",
        anchor_data: { node_id: "test-node", start_offset: 0, end_offset: 5 },
        selected_text: "delete me",
        visibility: "shared",
      },
    });
    const annotation = await annResponse.json();

    const owner = await createAuthenticatedContext(browser, ownerAuth);
    const collab = await createAuthenticatedContext(browser, collabAuth);

    try {
      await Promise.all([
        openFileInViewer(owner.page, fileId),
        openFileInViewer(collab.page, fileId),
      ]);

      await Promise.all([
        owner.page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 }),
        collab.page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 15000 }),
      ]);

      // Both should see the annotation
      await expect(
        collab.page.locator(`[data-card-id="${annotation.id}"]`)
      ).toBeVisible({ timeout: 10000 });

      // Owner deletes via API
      await request.delete(`${backendURL}/annotations/${annotation.id}`, {
        headers: { Authorization: `Bearer ${ownerAuth.token}` },
      });

      // Owner bumps Y.js version
      await owner.page.evaluate(() => {
        const ydoc = window.__ydoc;
        if (ydoc) {
          const meta = ydoc.getMap("annotations-meta");
          meta.set("version", Date.now());
        }
      });

      // Collaborator should see the annotation disappear
      await expect(
        collab.page.locator(`[data-card-id="${annotation.id}"]`)
      ).not.toBeVisible({ timeout: 10000 });
    } finally {
      await owner.context.close();
      await collab.context.close();
    }
  });
});
