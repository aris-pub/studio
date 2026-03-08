/**
 * E2E regression test for compile persistence.
 *
 * Bug: POST /render/private rendered correctly in the preview but did not
 * persist the source to the database. After a page refresh the rendered
 * output reverted to the old content.
 *
 * Tag: @collab
 *
 * Scope: compile (Cmd+S / compile button) must persist source to DB
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  clearEditor,
  insertText,
  cleanupYjs,
} from "./yjs-helpers.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();

const INITIAL_SOURCE = "# Original Title\n\nSome paragraph.";
const UPDATED_SOURCE = "# Updated Title\n\nNew paragraph with changes.";

async function getFileFromDatabase(fileId, token) {
  const response = await fetch(`${backendURL}/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  return response.json();
}

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

test.describe("Compile Persistence @collab", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("compiled content should survive a full page reload", async ({ browser, request }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id, INITIAL_SOURCE);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);
      await clearEditor(page);
      await insertText(page, UPDATED_SOURCE);

      await page.waitForFunction(
        () => window.__ytext?.toString().includes("Updated Title"),
        {},
        { timeout: 10000 }
      );

      // Trigger compile and wait for the render response
      const compilePromise = page.waitForResponse(
        (response) => response.url().includes("/render/private") && response.status() === 200,
        { timeout: 15000 }
      );
      await page.keyboard.press("Meta+s");
      await compilePromise;

      await waitForCompiledContent(page, "Updated Title");

      // Full page reload
      await cleanupYjs(page);
      await page.reload({ waitUntil: "domcontentloaded" });

      await page.waitForSelector('[data-testid="manuscript-viewer"]', { timeout: 15000 });

      await expect
        .poll(
          async () => {
            const viewers = page.locator('[data-testid="manuscript-viewer"]');
            const count = await viewers.count();
            if (count !== 1) return "";
            return (await viewers.first().textContent()) ?? "";
          },
          { timeout: 15000 }
        )
        .toContain("Updated Title");

      // The old title must not appear
      const viewerText = await page.locator('[data-testid="manuscript-viewer"]').textContent();
      expect(viewerText).not.toContain("Original Title");
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });

  test("compiled source should be persisted to the database", async ({ browser, request }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id, INITIAL_SOURCE);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);
      await clearEditor(page);
      await insertText(page, UPDATED_SOURCE);

      await page.waitForFunction(
        () => window.__ytext?.toString().includes("Updated Title"),
        {},
        { timeout: 10000 }
      );

      const compilePromise = page.waitForResponse(
        (response) => response.url().includes("/render/private") && response.status() === 200,
        { timeout: 15000 }
      );
      await page.keyboard.press("Meta+s");
      await compilePromise;

      // Poll the DB until the updated source appears
      await expect
        .poll(
          async () => {
            const data = await getFileFromDatabase(fileId, auth.token);
            return data.source ?? "";
          },
          { timeout: 10000 }
        )
        .toContain("# Updated Title");

      const fileData = await getFileFromDatabase(fileId, auth.token);
      expect(fileData.source).toContain("New paragraph with changes.");
      expect(fileData.source).not.toContain("Original Title");
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
