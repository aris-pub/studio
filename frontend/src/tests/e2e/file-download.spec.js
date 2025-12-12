import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// @auth
import { AuthHelpers } from "./utils/auth-helpers.js";
import { FileHelpers } from "./utils/file-helpers.js";

test.describe("File Download Tests @auth @desktop-only", () => {
  let authHelpers;
  let fileHelpers;
  let testFileId;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    fileHelpers = new FileHelpers(page);

    await authHelpers.ensureLoggedIn();

    // Create test file once for the test
    testFileId = await fileHelpers.createNewFile();
    await fileHelpers.navigateToHome();
  });

  test("download menu item appears in file context menu", async ({ page }) => {
    await fileHelpers.ensureFileDeselected(testFileId);
    await fileHelpers.openFileMenu(testFileId);

    const downloadItem = page.locator('[data-testid="file-menu-download"]');
    await expect(downloadItem).toBeVisible();
  });

  test("download triggers file save with correct filename", async ({ page }) => {
    await fileHelpers.ensureFileDeselected(testFileId);
    await fileHelpers.openFileMenu(testFileId);

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });

    // Click download option
    await page.locator('[data-testid="file-menu-download"]').click();

    // Wait for download to start
    const download = await downloadPromise;

    // Verify download has correct filename pattern
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.html$/);

    // Save and verify content structure
    const downloadPath = path.join("/tmp", `test-download-${Date.now()}.html`);
    await download.saveAs(downloadPath);

    const content = fs.readFileSync(downloadPath, "utf-8");

    // Should contain HTML tags from RSM rendering
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("<");

    // Clean up
    fs.unlinkSync(downloadPath);
  });

  test("downloaded file is standalone with CDN URLs", async ({ page }) => {
    await fileHelpers.ensureFileDeselected(testFileId);
    await fileHelpers.openFileMenu(testFileId);

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    await page.locator('[data-testid="file-menu-download"]').click();
    const download = await downloadPromise;

    const downloadPath = path.join("/tmp", `test-standalone-${Date.now()}.html`);
    await download.saveAs(downloadPath);

    const content = fs.readFileSync(downloadPath, "utf-8");

    // Should NOT use /static/ paths (these fail when opened locally)
    expect(content).not.toContain('href="/static/rsm.css"');
    expect(content).not.toContain('src="/static/jquery');

    // Should use CDN URLs for third-party libraries
    expect(content).toContain("cdn.jsdelivr.net");

    fs.unlinkSync(downloadPath);
  });

  test("downloaded file contains complete HTML structure", async ({ page }) => {
    await fileHelpers.ensureFileDeselected(testFileId);
    await fileHelpers.openFileMenu(testFileId);

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    await page.locator('[data-testid="file-menu-download"]').click();
    const download = await downloadPromise;

    const downloadPath = path.join("/tmp", `test-complete-${Date.now()}.html`);
    await download.saveAs(downloadPath);

    const content = fs.readFileSync(downloadPath, "utf-8");
    const contentLower = content.toLowerCase();

    // Must be a complete HTML document
    expect(contentLower).toContain("<html");
    expect(contentLower).toContain("<head");
    expect(contentLower).toContain("<body");
    expect(contentLower).toContain("</html>");

    fs.unlinkSync(downloadPath);
  });

  test("downloaded file uses correct jQuery version from CDN", async ({
    page,
  }) => {
    await fileHelpers.ensureFileDeselected(testFileId);
    await fileHelpers.openFileMenu(testFileId);

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    await page.locator('[data-testid="file-menu-download"]').click();
    const download = await downloadPromise;

    const downloadPath = path.join("/tmp", `test-jquery-${Date.now()}.html`);
    await download.saveAs(downloadPath);

    const content = fs.readFileSync(downloadPath, "utf-8");

    // Must use exact jQuery 3.6.0 version
    expect(content).toContain("jquery@3.6.0");

    fs.unlinkSync(downloadPath);
  });
});
