// @collab
import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
} from "./yjs-helpers.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();

async function openFileInEditor(page, fileId) {
  await page.goto(`/file/${fileId}`, { waitUntil: "commit" });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 12000 });
  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });
}

test.describe("Y.js Backend Client Cleanup @collab", () => {
  test("changes persist after user closes file (backend saves before cleanup)", async ({
    browser,
    request,
  }) => {
    const auth = await loginUser(request);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      const testContent =
        "# Test Persistence\n\nThis content should persist after closing the file.";
      await page.evaluate((content) => {
        const view = window.__cmView;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
      }, testContent);

      // Poll until the backend has persisted (debounced 500ms + network)
      await expect
        .poll(
          async () => {
            const r = await request.get(`${backendURL}/files/${fileId}`, {
              headers: { Authorization: `Bearer ${auth.token}` },
            });
            const data = await r.json();
            return (data.source ?? "").includes("Test Persistence");
          },
          { timeout: 5000 }
        )
        .toBe(true);

      // Navigate away (closes frontend connection → multiplayer server → backend cleanup)
      await page.goto("/", { waitUntil: "commit" });
      await page.waitForSelector('[data-testid="files-container"]', { timeout: 10000 });

      // Poll until backend cleanup completes and content is still there
      await expect
        .poll(
          async () => {
            const r = await request.get(`${backendURL}/files/${fileId}`, {
              headers: { Authorization: `Bearer ${auth.token}` },
            });
            const data = await r.json();
            return (data.source ?? "").includes("Test Persistence");
          },
          { timeout: 5000 }
        )
        .toBe(true);

      // Reopen the file and verify content
      await openFileInEditor(page, fileId);
      const persistedContent = await page.evaluate(() => window.__cmView.state.doc.toString());
      expect(persistedContent).toContain("Test Persistence");
      expect(persistedContent).toContain("This content should persist after closing the file.");
    } finally {
      // Explicitly stop the backend client (the reopen above started a second one).
      // The browser context closing does not reliably trigger Vue's onBeforeUnmount,
      // so we stop via HTTP before teardown.
      await request
        .post(`${backendURL}/files/${fileId}/collab/stop`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        })
        .catch(() => {});
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("changes persist across tab close and reopen", async ({ browser, request }) => {
    const auth = await loginUser(request);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      const testContent = "# Tab Close Test\n\nContent should survive tab closure.";
      await page.evaluate((content) => {
        const view = window.__cmView;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
      }, testContent);

      // Poll until backend has persisted
      await expect
        .poll(
          async () => {
            const r = await request.get(`${backendURL}/files/${fileId}`, {
              headers: { Authorization: `Bearer ${auth.token}` },
            });
            const data = await r.json();
            return (data.source ?? "").includes("Tab Close Test");
          },
          { timeout: 5000 }
        )
        .toBe(true);

      // Close the tab (simulates user closing tab)
      await page.close();

      // Poll until backend cleanup completes (YDocClient disconnects)
      await expect
        .poll(
          async () => {
            const r = await request.get(`${backendURL}/files/${fileId}`, {
              headers: { Authorization: `Bearer ${auth.token}` },
            });
            const data = await r.json();
            return (data.source ?? "").includes("Tab Close Test");
          },
          { timeout: 5000 }
        )
        .toBe(true);

      // Open new tab and inject auth state
      const newPage = await context.newPage();
      await newPage.goto("/", { waitUntil: "commit" });
      await newPage.evaluate(
        ({ tok, refTok, user }) => {
          localStorage.setItem("accessToken", tok);
          localStorage.setItem("refreshToken", refTok);
          localStorage.setItem("user", JSON.stringify(user));
        },
        { tok: auth.token, refTok: auth.refreshToken, user: auth.userData }
      );

      await openFileInEditor(newPage, fileId);
      const persistedContent = await newPage.evaluate(() => window.__cmView.state.doc.toString());
      expect(persistedContent).toContain("Tab Close Test");
      expect(persistedContent).toContain("Content should survive tab closure.");

      await newPage.close();
    } finally {
      await deleteTestFile(request, auth.token, fileId);
      await context.close();
    }
  });
});
