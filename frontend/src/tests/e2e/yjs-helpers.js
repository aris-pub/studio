/**
 * Shared helpers for Y.js E2E tests.
 *
 * Separates three concerns that were previously bundled together:
 *   1. Authentication (login, get user)       → loginUser()
 *   2. File lifecycle (create, delete)        → createTestFile(), deleteTestFile()
 *   3. Browser context creation              → createAuthenticatedContext()
 *
 * Tests use beforeAll/afterAll for file lifecycle and per-test context creation,
 * so backend YDocClients never accumulate across tests.
 */

import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginUser(request, email = TEST_USER_EMAIL, password = TEST_USER_PASSWORD) {
  const loginResponse = await request.post(`${backendURL}/login`, {
    data: { email, password },
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

  return { token: loginData.access_token, refreshToken: loginData.refresh_token, userData };
}

// ─── File lifecycle ───────────────────────────────────────────────────────────

export async function createTestFile(request, token, userId, source = "") {
  const response = await request.post(`${backendURL}/files`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "", abstract: "", source, owner_id: userId },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create file: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()).id;
}

export async function deleteTestFile(request, token, fileId) {
  await request
    .delete(`${backendURL}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .catch(() => {});
}

// ─── Browser context ──────────────────────────────────────────────────────────

export async function createAuthenticatedContext(browser, { token, refreshToken, userData }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "commit" });
  await page.evaluate(
    ({ tok, refTok, user }) => {
      localStorage.setItem("accessToken", tok);
      localStorage.setItem("refreshToken", refTok);
      localStorage.setItem("user", JSON.stringify(user));
    },
    { tok: token, refTok: refreshToken, user: userData }
  );
  return { context, page };
}

// ─── Editor helpers ───────────────────────────────────────────────────────────

export async function openFileInEditor(page, fileId) {
  await page.goto(`/file/${fileId}`, { waitUntil: "commit" });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 12000 });

  const editorAlreadyOpen = await page.locator(".cm-editor").isVisible();
  if (!editorAlreadyOpen) {
    await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  }
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });
}

export async function clearEditor(page) {
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
  });
  await page.waitForFunction(
    () => window.__ytext.toString().length === 0 && window.__cmView.state.doc.length === 0,
    {},
    { timeout: 5000 }
  );
}

// Insert text programmatically. Uses `includes` for Y.text check so it works
// correctly in multi-tab scenarios where concurrent edits can change total length.
export async function insertText(page, text) {
  const startLength = await page.evaluate(() => window.__cmView.state.doc.length);
  await page.evaluate((txt) => {
    const view = window.__cmView;
    view.dispatch({ changes: { from: view.state.doc.length, insert: txt } });
  }, text);
  await page.waitForFunction(
    ({ expectedLength }) => window.__cmView.state.doc.length === expectedLength,
    { expectedLength: startLength + text.length },
    { timeout: 5000 }
  );
  await page.waitForFunction((txt) => window.__ytext.toString().includes(txt), text, {
    timeout: 5000,
  });
}

// Type character-by-character via keyboard (for keystroke duplication tests).
export async function typeInEditor(page, text) {
  const beforeLength = await page.evaluate(() => window.__cmView.state.doc.length);
  await page.click(".cm-content");
  await page.keyboard.type(text, { delay: 50 });
  await page.waitForFunction(
    ({ before, added }) => window.__cmView.state.doc.length === before + added,
    { before: beforeLength, added: text.length },
    { timeout: 5000 }
  );
}

export async function getEditorContent(page) {
  return await page.evaluate("window.__cmView.state.doc.toString()");
}

export async function getYTextContent(page) {
  return await page.evaluate("window.__ytext.toString()");
}

// Wait for a specific string to appear in the editor on `page`.
// Uses waitForFunction (condition poll) not a fixed sleep.
export async function waitForSync(page, expectedContent) {
  await page.waitForFunction(
    (content) => {
      const editorContent = window.__cmView?.state.doc.toString() || "";
      return editorContent.includes(content);
    },
    expectedContent,
    { timeout: 5000 }
  );
}

// Disconnect and destroy Y.js provider before closing context.
// Waits for WebSocket to fully close to avoid half-open connections
// bleeding into subsequent tests.
export async function cleanupYjs(page) {
  try {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.__provider) {
          const ws = window.__provider.ws;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.addEventListener("close", () => resolve(), { once: true });
            window.__provider.disconnect();
            window.__provider.destroy();
          } else {
            window.__provider.disconnect();
            window.__provider.destroy();
            resolve();
          }
          delete window.__provider;
        } else {
          resolve();
        }
        if (window.__ydoc) {
          window.__ydoc.destroy();
          delete window.__ydoc;
        }
        delete window.__ytext;
        delete window.__awareness;
        delete window.__cmView;
      });
    });
  } catch (_error) {
    // Ignore — page may already be closed
  }
}
