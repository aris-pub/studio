// @collab
import { test, expect } from "@playwright/test";
import { AuthHelpers } from "./utils/auth-helpers.js";
import { FileHelpers } from "./utils/file-helpers.js";

test.describe("Y.js Backend Client Cleanup @collab", () => {
  let authHelpers, fileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);
    await authHelpers.ensureLoggedIn();
  });

  test.afterEach(async () => {
    await authHelpers.clearAuthState();
  });

  test("changes persist after user closes file (backend saves before cleanup)", async ({
    page,
  }) => {
    // Create a new file
    const fileId = await fileHelpers.createNewFile();

    // Navigate to file
    await page.goto(`/file/${fileId}`);
    await page.waitForSelector('[data-testid="manuscript-viewer"]', { timeout: 5000 });

    // Open source editor
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: 5000 });

    // Wait for CodeMirror to load
    await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

    // Make an edit via CodeMirror
    const testContent = "# Test Persistence\n\nThis content should persist after closing the file.";
    await page.evaluate((content) => {
      const view = window.__cmView;
      const doc = view.state.doc;
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: content },
      });
    }, testContent);

    // Wait for backend to persist (debounced 500ms + buffer)
    await page.waitForTimeout(2000);

    // Navigate away (closes frontend connection → multiplayer server → backend cleanup)
    await page.goto("/");
    await page.waitForSelector('[data-testid="files-container"]', { timeout: 5000 });

    // Wait for cleanup to complete
    await page.waitForTimeout(2000);

    // Reopen the file
    await page.goto(`/file/${fileId}`);
    await page.waitForSelector('[data-testid="manuscript-viewer"]', { timeout: 5000 });

    // Open source editor again
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: 5000 });
    await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

    // Verify the content persisted
    const persistedContent = await page.evaluate(() => window.__cmView.state.doc.toString());
    expect(persistedContent).toContain("Test Persistence");
    expect(persistedContent).toContain("This content should persist after closing the file.");
  });

  test("changes persist across tab close and reopen", async ({ page, context }) => {
    // Create a new file
    const fileId = await fileHelpers.createNewFile();

    // Navigate to file
    await page.goto(`/file/${fileId}`);
    await page.waitForSelector('[data-testid="manuscript-viewer"]', { timeout: 5000 });

    // Open source editor and make an edit
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: 5000 });
    await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

    const testContent = "# Tab Close Test\n\nContent should survive tab closure.";
    await page.evaluate((content) => {
      const view = window.__cmView;
      const doc = view.state.doc;
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: content },
      });
    }, testContent);

    // Wait for persistence
    await page.waitForTimeout(2000);

    // Close the tab (simulates user closing tab)
    await page.close();

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Open new tab and verify content persisted
    const newPage = await context.newPage();
    await authHelpers.injectAuthState(newPage);
    await newPage.goto(`/file/${fileId}`);
    await newPage.waitForSelector('[data-testid="manuscript-viewer"]', { timeout: 5000 });

    // Check content
    await newPage.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await newPage.waitForSelector(".cm-editor", { timeout: 5000 });
    await newPage.waitForFunction(
      () => typeof window.__cmView !== "undefined",
      {},
      { timeout: 5000 }
    );

    const persistedContent = await newPage.evaluate(() => window.__cmView.state.doc.toString());
    expect(persistedContent).toContain("Tab Close Test");
    expect(persistedContent).toContain("Content should survive tab closure.");

    await newPage.close();
  });
});
