/**
 * E2E test for automatic compilation when editing with CodeMirror
 *
 * Tests that edits in CodeMirror trigger automatic compilation after debounce,
 * without requiring manual "compile" button click.
 *
 * Tag: @auth
 * TDD: This test should FAIL initially, then PASS after implementing Y.Doc observer
 */

import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve("../../../.env") });
const BACKEND_PORT = process.env.BACKEND_PORT;
const FRONTEND_PORT = process.env.FRONTEND_PORT;

if (!BACKEND_PORT || !FRONTEND_PORT) {
  throw new Error("BACKEND_PORT and FRONTEND_PORT must be set in .env");
}

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env");
}

async function createAuthenticatedPage(browser, request) {
  const loginResponse = await request.post(`http://localhost:${BACKEND_PORT}/login`, {
    data: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`);
  }

  const loginData = await loginResponse.json();

  const userResponse = await request.get(`http://localhost:${BACKEND_PORT}/me`, {
    headers: { Authorization: `Bearer ${loginData.access_token}` },
  });

  if (!userResponse.ok()) {
    throw new Error(`Failed to fetch user data: ${userResponse.status()}`);
  }

  const userData = await userResponse.json();

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`http://localhost:${FRONTEND_PORT}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (data) => {
      localStorage.setItem("accessToken", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    },
    { ...loginData, user: userData }
  );

  return { context, page, accessToken: loginData.access_token, userId: userData.id };
}

test.describe("CodeMirror Auto-Compilation @auth", () => {
  let context;
  let page;
  let fileId;
  let accessToken;

  test.beforeEach(async ({ browser, request }) => {
    ({ context, page, accessToken } = await createAuthenticatedPage(browser, request));

    const user = JSON.parse(await page.evaluate(() => localStorage.getItem("user")));

    // Create test file with minimal source for fast compilation
    const createResponse = await request.post(`http://localhost:${BACKEND_PORT}/files`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        title: `Auto-compile Test ${Date.now()}`,
        abstract: "",
        owner_id: user.id,
        source: "# Test\n\nHello",
      },
    });

    if (!createResponse.ok()) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create test file: ${createResponse.status()} - ${errorText}`);
    }

    const fileData = await createResponse.json();
    fileId = fileData.id;

    // Compile once to generate initial HTML
    await request.post(`http://localhost:${BACKEND_PORT}/render/private`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        source: "# Test\n\nHello",
        file_id: fileId,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    if (fileId && accessToken) {
      try {
        const response = await request.delete(`http://localhost:${BACKEND_PORT}/files/${fileId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok()) {
          console.error(`Failed to delete file ${fileId}: ${response.status()}`);
        }
      } catch (error) {
        console.error(`Error during cleanup of file ${fileId}:`, error);
      }
    }

    if (context) {
      await context.close();
    }
  });

  test("should auto-compile after editing in CodeMirror", async () => {
    // Navigate to file
    await page.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });

    // Verify initial content
    const initialContent = await page.textContent('[data-testid="manuscript-viewer"]');
    expect(initialContent).toContain("Hello");
    expect(initialContent).not.toContain("World");

    // Open CodeMirror editor
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: 5000 });
    await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
    await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });

    // Edit content via CodeMirror
    await page.evaluate(() => {
      const view = window.__cmView;
      const currentLength = view.state.doc.length;
      view.dispatch({
        changes: { from: currentLength, insert: " World" },
      });
    });

    // Verify CodeMirror was updated
    await page.waitForFunction(
      () => window.__cmView.state.doc.toString().includes("World"),
      {},
      { timeout: 5000 }
    );

    // Set up listener for render API call BEFORE waiting
    const compileResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/render/private") && response.status() === 200,
      { timeout: 10000 } // Give it 10 seconds for debounce (2s) + compilation time
    );

    // CRITICAL: Do NOT click compile button - test auto-compilation
    // await page.click('button:has-text("compile")'); // ← REMOVED

    // Wait for automatic compilation to trigger
    await compileResponsePromise;

    // Wait for preview to update with new content
    await page.waitForFunction(
      () => {
        const viewer = document.querySelector('[data-testid="manuscript-viewer"]');
        return viewer?.textContent?.includes("World");
      },
      {},
      { timeout: 10000 }
    );

    // Verify final content includes edit
    const updatedContent = await page.textContent('[data-testid="manuscript-viewer"]');
    expect(updatedContent).toContain("Hello World");
  });

  test("should debounce rapid edits and compile once", async () => {
    // Navigate to file
    await page.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });

    // Open CodeMirror editor
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: 5000 });
    await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
    await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });

    // Track compilation count
    let compileCount = 0;
    page.on("response", (response) => {
      if (response.url().includes("/render/private") && response.status() === 200) {
        compileCount++;
      }
    });

    // Make 5 rapid edits within debounce window
    for (let i = 1; i <= 5; i++) {
      await page.evaluate((num) => {
        const view = window.__cmView;
        const currentLength = view.state.doc.length;
        view.dispatch({
          changes: { from: currentLength, insert: ` ${num}` },
        });
      }, i);
      await page.waitForTimeout(300); // 300ms between edits (< 2000ms debounce)
    }

    // Wait for final compilation (should only happen once after last edit)
    await page.waitForResponse(
      (response) => response.url().includes("/render/private") && response.status() === 200,
      { timeout: 10000 }
    );

    // Wait a bit more to ensure no additional compilations
    await page.waitForTimeout(2000);

    // Verify only ONE compilation happened (debouncing worked)
    expect(compileCount).toBe(1);

    // Verify all edits are in the preview
    const finalContent = await page.textContent('[data-testid="manuscript-viewer"]');
    expect(finalContent).toContain("1");
    expect(finalContent).toContain("5");
  });
});
