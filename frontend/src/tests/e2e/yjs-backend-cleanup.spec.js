// @collab
import { test, expect } from "./fixtures.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

async function createAuthenticatedPage(browser, request) {
  const loginResponse = await request.post(`${backendURL}/login`, {
    data: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`);
  }

  const loginData = await loginResponse.json();

  const userResponse = await request.get(`${backendURL}/me`, {
    headers: { Authorization: `Bearer ${loginData.access_token}` },
  });

  if (!userResponse.ok()) {
    throw new Error(`Failed to fetch user data: ${userResponse.status()}`);
  }

  const userData = await userResponse.json();

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`/`, { waitUntil: "domcontentloaded" });
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

async function createFileViaAPI(request, accessToken, userId) {
  const response = await request.post(`${backendURL}/files`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      title: "Test Persistence File",
      abstract: "",
      source: "",
      owner_id: userId,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create file: ${response.status()} ${await response.text()}`);
  }

  const data = await response.json();
  return data.id;
}

async function openFileInEditor(page, fileId) {
  await page.goto(`/file/${fileId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="workspace-sidebar"]', { timeout: 5000 });
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
    const { context, page, accessToken, userId } = await createAuthenticatedPage(browser, request);

    try {
      const fileId = await createFileViaAPI(request, accessToken, userId);
      await openFileInEditor(page, fileId);

      // Make an edit via CodeMirror
      const testContent =
        "# Test Persistence\n\nThis content should persist after closing the file.";
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
      await openFileInEditor(page, fileId);

      // Verify the content persisted
      const persistedContent = await page.evaluate(() => window.__cmView.state.doc.toString());
      expect(persistedContent).toContain("Test Persistence");
      expect(persistedContent).toContain("This content should persist after closing the file.");
    } finally {
      await context.close();
    }
  });

  test("changes persist across tab close and reopen", async ({ browser, request }) => {
    const { context, page, accessToken, userId } = await createAuthenticatedPage(browser, request);

    try {
      const fileId = await createFileViaAPI(request, accessToken, userId);
      await openFileInEditor(page, fileId);

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

      // Get auth tokens before closing tab
      const authTokens = await page.evaluate(() => ({
        accessToken: localStorage.getItem("accessToken"),
        refreshToken: localStorage.getItem("refreshToken"),
        user: localStorage.getItem("user"),
      }));

      // Close the tab (simulates user closing tab)
      await page.close();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Open new tab and inject auth state
      const newPage = await context.newPage();
      await newPage.goto("/", { waitUntil: "domcontentloaded" });
      await newPage.evaluate((tokens) => {
        localStorage.setItem("accessToken", tokens.accessToken);
        localStorage.setItem("refreshToken", tokens.refreshToken);
        localStorage.setItem("user", tokens.user);
      }, authTokens);

      // Open file in new tab
      await newPage.goto(`/file/${fileId}`, { waitUntil: "domcontentloaded" });
      await newPage.waitForSelector('[data-testid="workspace-sidebar"]', { timeout: 5000 });
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
    } finally {
      await context.close();
    }
  });
});
