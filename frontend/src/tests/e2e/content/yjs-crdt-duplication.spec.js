// @auth @auth-content
import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";
import { getBackendURL } from "../utils/test-config.js";

/**
 * Y.js CRDT Content Duplication Regression Test
 *
 * This test replicates a bug in the backend Y.js client (yjs_client.py) where
 * _connect_and_run() creates a fresh Doc() and inserts stale DB content via
 * _load_from_db() BEFORE syncing with the WebSocket room. If the room already
 * has newer content (e.g., from frontend edits dispatched before or between
 * backend connections), Y.js CRDT merges both versions, permanently duplicating
 * the document content.
 *
 * Unlike mathjax-duplication.spec.js, this test uses plain RSM (no math) to
 * isolate the Y.js CRDT bug from MathJax rendering behavior.
 *
 * Root cause — backend/aris/collaboration/yjs_client.py _connect_and_run():
 *
 *   self.doc = Doc()               # fresh Y.Doc, new client IDs every time
 *   await self._load_from_db()     # inserts DB content before room sync
 *   await self._send_sync_step1()  # only THEN syncs with room
 *
 * If the room already has edits with different client IDs (made while the
 * backend was disconnected or not yet connected), CRDT preserves both sets of
 * items → permanent duplication that propagates to all peers.
 *
 * Fix: sync with room first, then load from DB only if room is empty.
 */

const RSM_SOURCE_NO_MATH = `# Test Document for YJS Bug

This is a simple paragraph without any math.

Here is another paragraph with some content.

And a final paragraph with more content.`;

test.describe("Y.js CRDT Content Duplication @auth @desktop-only", () => {
  let authHelpers;
  let baseURL;
  let accessToken;
  let testUserId;

  test.beforeEach(async ({ page }) => {
    baseURL = getBackendURL();
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
    await page.waitForLoadState("load").catch(() => {});
    accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));
    const userData = await page.evaluate(() => JSON.parse(localStorage.getItem("user")));
    testUserId = userData.id;
  });

  test.afterEach(async ({ page }) => {
    await page.waitForLoadState("load").catch(() => {});
  });

  async function createTestFile(request, source) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const createResponse = await request.post(`${baseURL}/files`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { title: "YJS Duplication Test", owner_id: testUserId, source },
      });
      if (createResponse.ok()) {
        return (await createResponse.json()).id;
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw new Error(`File creation failed: ${createResponse.status()}`);
      }
    }
  }

  async function deleteTestFile(request, fileId) {
    try {
      await request.delete(`${baseURL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Wait for compiled content to appear in the manuscript viewer.
   *
   * After compile, Canvas destroys the old ManuscriptWrapper (via :key="file.html")
   * and mounts a new one. During Vue's reconciliation both instances can briefly
   * coexist. This waits until exactly one viewer exists and it contains the marker.
   */
  async function waitForCompiledContent(page, contentMarker) {
    await page.waitForFunction(
      (marker) => {
        const viewers = document.querySelectorAll('[data-testid="manuscript-viewer"]');
        if (viewers.length !== 1) return false;
        return viewers[0].textContent?.includes(marker) ?? false;
      },
      contentMarker,
      { timeout: 15000 }
    );
  }

  test("source content should not duplicate in Y.js after editing and compiling", async ({
    page,
    request,
  }) => {
    test.setTimeout(60000);

    const fileId = await createTestFile(request, RSM_SOURCE_NO_MATH);

    try {
      await page.goto(`/file/${fileId}`);

      // Wait for the manuscript to load and show the initial content
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 5000,
      });
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="manuscript-viewer"]')
            ?.textContent?.includes("Test Document for YJS Bug"),
        { timeout: 5000 }
      );

      // Open source editor
      await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
      await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({ timeout: 5000 });
      await page.waitForSelector(".cm-editor", { timeout: 15000 });
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );
      await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });

      // EDIT1: append marker to heading
      await page.evaluate(() => {
        const view = window.__cmView;
        const text = view.state.doc.toString();
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: text.replace(
              "# Test Document for YJS Bug",
              "# Test Document for YJS Bug EDIT1"
            ),
          },
        });
      });

      await page.waitForFunction(
        () => window.__ytext?.toString().includes("EDIT1"),
        {},
        { timeout: 5000 }
      );

      // Set up response listener BEFORE clicking compile
      const compileResponse = page.waitForResponse(
        (response) => response.url().includes("/render/private") && response.status() === 200,
        { timeout: 15000 }
      );
      await page.click('button:has-text("compile")');
      await compileResponse;

      // On mobile, switch to manuscript view to check compiled output
      const viewport = page.viewportSize();
      const isMobile = viewport && viewport.width < 640;
      if (isMobile) {
        await page.locator(".sb-item").filter({ hasText: "source" }).click();
        await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        });
      }

      await waitForCompiledContent(page, "EDIT1");

      const afterFirstEdit = await page.evaluate(() => {
        const viewerText =
          document.querySelector('[data-testid="manuscript-viewer"]')?.textContent || "";
        const ytextContent = window.__ytext?.toString() || "";
        return {
          // Compiled output: heading should appear exactly once
          titleCount: (viewerText.match(/Test Document for YJS Bug/g) || []).length,
          // Y.js doc itself: raw heading marker should appear exactly once
          ytextTitleCount: (ytextContent.match(/# Test Document for YJS Bug/g) || []).length,
        };
      });

      expect(afterFirstEdit.titleCount).toBe(1);
      expect(afterFirstEdit.ytextTitleCount).toBe(1);

      // On mobile, switch back to source for second edit
      if (isMobile) {
        await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
        await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
          timeout: 5000,
        });
        await page.waitForSelector(".cm-editor", { timeout: 15000 });
        await page.waitForFunction(
          () => typeof window.__cmView !== "undefined",
          {},
          { timeout: 5000 }
        );
      }

      // EDIT2: append second marker
      await page.evaluate(() => {
        const view = window.__cmView;
        const text = view.state.doc.toString();
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: text.replace("EDIT1", "EDIT1 EDIT2"),
          },
        });
      });

      await page.waitForFunction(
        () => window.__ytext?.toString().includes("EDIT2"),
        {},
        { timeout: 5000 }
      );

      // Set up response listener BEFORE clicking compile
      const compileResponse = page.waitForResponse(
        (response) => response.url().includes("/render/private") && response.status() === 200,
        { timeout: 15000 }
      );
      await page.click('button:has-text("compile")');
      await compileResponse;

      if (isMobile) {
        await page.locator(".sb-item").filter({ hasText: "source" }).click();
        await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        });
      }

      await waitForCompiledContent(page, "EDIT2");

      const afterSecondEdit = await page.evaluate(() => {
        const viewerText =
          document.querySelector('[data-testid="manuscript-viewer"]')?.textContent || "";
        const ytextContent = window.__ytext?.toString() || "";
        return {
          titleCount: (viewerText.match(/Test Document for YJS Bug/g) || []).length,
          ytextTitleCount: (ytextContent.match(/# Test Document for YJS Bug/g) || []).length,
          // Capture the full Y.js content for failure diagnostics
          ytextLength: ytextContent.length,
          ytextPreview: ytextContent.substring(0, 200),
        };
      });

      // Both the compiled output and the raw Y.js text should contain the heading exactly once.
      // With the bug, the backend Y.js client inserts the original DB content on top of the
      // edited room state, causing "# Test Document for YJS Bug" to appear 2+ times.
      expect(afterSecondEdit.titleCount).toBe(1);
      expect(afterSecondEdit.ytextTitleCount).toBe(1);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });
});
