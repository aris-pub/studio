/**
 * E2E for std-iu0n: an out-of-band asset change recompiles the open tab.
 *
 * Bug: when an asset is changed from outside the tab (an AI agent via the API,
 * another tab, another user), the open editor kept showing the old asset until
 * the user manually recompiled. Fix: the backend publishes an "asset-changed"
 * event on the per-file SSE channel (GET /files/{id}/events); the tab subscribes
 * and recompiles on it.
 *
 * This asserts the whole path in a real browser: subscribe -> out-of-band asset
 * update -> the tab issues a /render/private on its own (no edit, no Cmd+S).
 *
 * Tag: @collab
 */

import { test } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  cleanupYjs,
} from "./yjs-helpers.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();
const SOURCE = "# Asset Doc\n\nA paragraph.";

async function createAsset(fileId, token) {
  const response = await fetch(`${backendURL}/files/${fileId}/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "data.txt", mime_type: "text/plain", content: "v1" }),
  });
  if (!response.ok) throw new Error(`create asset failed: ${response.status}`);
  return (await response.json()).id;
}

async function renameAsset(fileId, assetId, token, filename) {
  const response = await fetch(`${backendURL}/files/${fileId}/assets/${assetId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  if (!response.ok) throw new Error(`update asset failed: ${response.status}`);
}

test.describe("Asset change recompile @collab", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("an out-of-band asset update recompiles the open tab", async ({ browser, request }) => {
    test.setTimeout(60000);

    const fileId = await createTestFile(request, auth.token, auth.userData.id, SOURCE);
    const assetId = await createAsset(fileId, auth.token);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      // The tab's event subscription opens the SSE stream; wait for its response
      // headers so we know the backend has a live subscriber before we publish.
      const sseConnected = page.waitForResponse(
        (r) => r.url().includes(`/files/${fileId}/events`) && r.status() === 200,
        { timeout: 15000 }
      );

      await openFileInEditor(page, fileId);
      await page.waitForSelector('[data-testid="manuscript-viewer"]', { timeout: 15000 });
      await sseConnected;

      // Now change the asset from outside the tab (as an agent/API would). The
      // tab must recompile on its own — no keystroke, no Cmd+S.
      const recompiled = page.waitForResponse(
        (r) => r.url().includes("/render/private") && r.status() === 200,
        { timeout: 20000 }
      );
      await renameAsset(fileId, assetId, auth.token, "data-v2.txt");
      await recompiled;
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
