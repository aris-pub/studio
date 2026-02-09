/**
 * E2E test for compile button updating preview with Y.js content
 *
 * Regression test for bug where compile button used stale editSession.content
 * instead of current CodeMirror/Y.js content, causing preview to show outdated HTML.
 *
 * Tag: @auth
 * Commit: 6bd1bf50
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

test.describe("Compile Button Updates Preview @auth", () => {
  let context;
  let page;
  let fileId;
  let accessToken;

  test.beforeEach(async ({ browser, request }) => {
    ({ context, page, accessToken } = await createAuthenticatedPage(browser, request));

    const user = JSON.parse(await page.evaluate(() => localStorage.getItem("user")));

    // Always create a fresh test file for reliable testing
    const createResponse = await request.post(`http://localhost:${BACKEND_PORT}/files`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        title: `E2E Test ${Date.now()}`,
        abstract: "",
        owner_id: user.id,
        source: "# Original\n\noriginal text",
      },
    });

    if (!createResponse.ok()) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create test file: ${createResponse.status()} - ${errorText}`);
    }

    const fileData = await createResponse.json();
    fileId = fileData.id;

    // Compile it once to generate HTML
    await request.post(`http://localhost:${BACKEND_PORT}/render/private`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        source: "# Original\n\noriginal text",
        file_id: fileId,
      },
    });
  });

  test.afterEach(async ({ request }) => {
    if (fileId) {
      await request.delete(`http://localhost:${BACKEND_PORT}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    if (context) {
      await context.close();
    }
  });

  test("should compile and update preview with Y.js content", async () => {
    await page.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });

    const initialContent = await page.textContent('[data-testid="manuscript-viewer"]');
    expect(initialContent).toContain("original text");

    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
    await page.waitForSelector(".cm-editor", { timeout: 5000 });

    await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
    await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });

    await page.evaluate(() => {
      const view = window.__cmView;
      const currentLength = view.state.doc.length;
      view.dispatch({
        changes: { from: currentLength, insert: " updated" }
      });
    });

    await page.waitForFunction(
      () => window.__cmView.state.doc.toString().includes("updated"),
      {},
      { timeout: 5000 }
    );

    const compileResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/render/private") && response.status() === 200,
      { timeout: 10000 }
    );

    await page.click('button:has-text("compile")');
    await compileResponsePromise;

    await page.waitForFunction(
      () => {
        const viewer = document.querySelector('[data-testid="manuscript-viewer"]');
        return viewer?.textContent?.includes("updated");
      },
      {},
      { timeout: 10000 }
    );

    const updatedContent = await page.textContent('[data-testid="manuscript-viewer"]');
    expect(updatedContent).toContain("original text updated");
  });
});
