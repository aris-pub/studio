/**
 * E2E tests for Y.js MULTI-USER COLLABORATION WITH PERMISSIONS
 *
 * Tests that multiple different users can collaborate on the same file
 * with proper permission enforcement (OWNER/EDITOR/COMMENTER).
 *
 * Tag: @auth
 *
 * Scope: studio-q5r (Multi-user collaboration with permissions)
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

// Second test user for multi-user scenarios
const TEST_USER2_EMAIL = "testuser2@example.com";
const TEST_USER2_PASSWORD = "testpass123";
const TEST_USER2_NAME = "Test User 2";
const TEST_USER2_INITIALS = "TU2";

// Third test user for commenter role
const TEST_USER3_EMAIL = "testuser3@example.com";
const TEST_USER3_PASSWORD = "testpass123";
const TEST_USER3_NAME = "Test User 3";
const TEST_USER3_INITIALS = "TU3";

// Helper to create authenticated session
async function createAuthenticatedPage(browser, request, email, password) {
  const loginResponse = await request.post(`http://localhost:${BACKEND_PORT}/login`, {
    data: { email, password },
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
  console.log(`[TEST] Logged in as user ID: ${userData.id}, email: ${userData.email}`);

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

  return { context, page, token: loginData.access_token, userId: userData.id };
}

// Helper to register a new user (or skip if already exists)
async function registerUser(request, email, name, initials, password) {
  const response = await request.post(`http://localhost:${BACKEND_PORT}/register`, {
    data: { email, name, initials, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    // If user already exists, that's okay - we can still login
    if (
      response.status() === 409 ||
      body.includes("already registered") ||
      body.includes("already exists")
    ) {
      console.log(`[TEST] User ${email} already exists, skipping registration`);
      return null;
    }
    throw new Error(`Registration failed: ${response.status()} ${body}`);
  }

  console.log(`[TEST] User ${email} registered successfully`);
  return await response.json();
}

// Helper to open file and editor
async function openFileInEditor(page, fileId) {
  console.log(`[TEST] Opening file ${fileId} in editor`);

  // Listen for console errors
  page.on("pageerror", (error) => {
    console.log(`[TEST] Page error: ${error.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[TEST] Console error: ${msg.text()}`);
    }
  });

  const response = await page.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, {
    waitUntil: "domcontentloaded",
  });
  console.log(`[TEST] Page loaded with status: ${response?.status()}`);

  // Wait a bit for Vue to initialize
  await page.waitForTimeout(1000);

  // Check for error messages on page
  const pageText = await page.textContent("body").catch(() => "");
  if (
    pageText.includes("403") ||
    pageText.includes("Access denied") ||
    pageText.includes("Forbidden")
  ) {
    console.log(`[TEST] ERROR: Page shows access denied: ${pageText.substring(0, 200)}`);
    throw new Error("Access denied");
  }

  // Check if manuscript container exists before waiting
  const hasContainer = (await page.locator('[data-testid="manuscript-container"]').count()) > 0;
  if (!hasContainer) {
    console.log(`[TEST] ERROR: No manuscript container found. Page content:`);
    console.log(pageText.substring(0, 500));
    console.log(`[TEST] Page URL: ${page.url()}`);

    // Check if we got redirected
    if (page.url().includes("/login")) {
      throw new Error("Redirected to login - authentication issue");
    }
  }

  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });

  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector(".cm-editor", { timeout: 5000 });
  await page.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });
  console.log(`[TEST] File ${fileId} editor opened and synced`);
}

// Helper to insert text
async function insertText(page, text) {
  console.log(`[TEST] Inserting: "${text}"`);
  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
    view.dispatch({ changes: { from: pos, insert: txt } });
  }, text);

  await page.waitForFunction((txt) => window.__cmView.state.doc.toString().includes(txt), text, {
    timeout: 5000,
  });
  console.log(`[TEST] Text inserted`);
}

// Helper to clear editor
async function clearEditor(page) {
  console.log("[TEST] Clearing editor");
  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
  });

  await page.waitForFunction(() => window.__cmView.state.doc.length === 0, {}, { timeout: 5000 });
  await page.waitForFunction(() => window.__ytext.toString().length === 0, {}, { timeout: 5000 });
  console.log("[TEST] Editor cleared");
}

// Helper to get editor content
async function getEditorContent(page) {
  return await page.evaluate("window.__cmView.state.doc.toString()");
}

// Helper to wait for sync
async function waitForSync(page, expectedContent) {
  await page.waitForFunction(
    (content) => {
      const editorContent = window.__cmView?.state.doc.toString() || "";
      return editorContent.includes(content);
    },
    expectedContent,
    { timeout: 5000 }
  );
}

// Helper to add collaborator via API
async function addCollaborator(fileId, userId, role, token) {
  console.log(`[TEST] Adding collaborator: user ${userId} as ${role} to file ${fileId}`);
  const response = await fetch(`http://localhost:${BACKEND_PORT}/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, role }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    // If permission already exists, that's okay - we can proceed
    if (response.status === 400 && errorBody.includes("already has permission")) {
      console.log(`[TEST] Permission already exists, skipping`);
      return null;
    }
    console.log(`[TEST] Failed to add collaborator: ${response.status} - ${errorBody}`);
    throw new Error(`Failed to add collaborator: ${response.status} - ${errorBody}`);
  }

  const result = await response.json();
  console.log(`[TEST] Permission created:`, result);
  return result;
}

// Helper to cleanup Y.js state
async function cleanupYjs(page) {
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
  } catch (error) {
    console.log("[TEST] Y.js cleanup error (expected if page closed):", error.message);
  }
}

test.describe("Multi-User Collaboration @auth", () => {
  test("should allow OWNER and EDITOR to edit simultaneously", async ({ browser, request }) => {
    test.setTimeout(60000);

    // Register second user
    await registerUser(
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_NAME,
      TEST_USER2_INITIALS,
      TEST_USER2_PASSWORD
    );

    // Owner creates session
    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );

    // Editor creates session
    const editor = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_PASSWORD
    );

    try {
      const fileId = 1;

      // Owner opens file and clears it
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForTimeout(1000);

      // Owner adds editor as collaborator
      await addCollaborator(fileId, editor.userId, "EDITOR", owner.token);
      console.log("[TEST] Added EDITOR collaborator");

      // Editor opens file
      await openFileInEditor(editor.page, fileId);

      // Owner types
      const ownerText = "Owner: Hello from owner\n";
      await insertText(owner.page, ownerText);
      await waitForSync(editor.page, ownerText);

      // Editor types
      const editorText = "Editor: Hello from editor\n";
      await insertText(editor.page, editorText);
      await waitForSync(owner.page, editorText);

      // Both should see both texts
      const ownerContent = await getEditorContent(owner.page);
      const editorContent = await getEditorContent(editor.page);

      expect(ownerContent).toContain(ownerText);
      expect(ownerContent).toContain(editorText);
      expect(editorContent).toContain(ownerText);
      expect(editorContent).toContain(editorText);
      expect(ownerContent).toBe(editorContent);

      console.log("[TEST] ✅ OWNER and EDITOR can both edit");
    } finally {
      await cleanupYjs(owner.page);
      await cleanupYjs(editor.page);
      await owner.context.close();
      await editor.context.close();
    }
  });

  test("should allow COMMENTER to view but not edit", async ({ browser, request }) => {
    test.setTimeout(60000);

    // Register third user
    await registerUser(
      request,
      TEST_USER3_EMAIL,
      TEST_USER3_NAME,
      TEST_USER3_INITIALS,
      TEST_USER3_PASSWORD
    );

    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );
    const commenter = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER3_EMAIL,
      TEST_USER3_PASSWORD
    );

    try {
      const fileId = 1;

      // Owner prepares file
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForTimeout(1000);

      const ownerText = "Owner content\n";
      await insertText(owner.page, ownerText);

      // Add commenter
      await addCollaborator(fileId, commenter.userId, "COMMENTER", owner.token);
      console.log("[TEST] Added COMMENTER collaborator");

      // Commenter opens file
      await openFileInEditor(commenter.page, fileId);

      // Commenter should see owner's content
      const commenterContent = await getEditorContent(commenter.page);
      expect(commenterContent).toContain(ownerText);

      // Check if editor is read-only for commenter
      const isReadOnly = await commenter.page.evaluate(() => {
        return window.__cmView.state.facet(window.__cmView.state.facet.of({ editable: false }));
      });

      // TODO: Implement read-only mode for COMMENTER role
      // For now, this test will fail - that's expected in TDD
      expect(isReadOnly).toBe(true);

      console.log("[TEST] ✅ COMMENTER can view but not edit");
    } finally {
      await cleanupYjs(owner.page);
      await cleanupYjs(commenter.page);
      await owner.context.close();
      await commenter.context.close();
    }
  });

  test("should reject unauthorized user connection", async ({ browser, request }) => {
    test.setTimeout(60000);

    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );
    const unauthorized = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_PASSWORD
    );

    try {
      const fileId = 1;

      // Owner opens file
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForTimeout(1000);

      // Unauthorized user tries to open file (no permission granted)
      // This should either:
      // 1. Fail to load the file (403)
      // 2. Or load in read-only mode and fail to connect to Y.js

      let connectionFailed = false;
      try {
        await unauthorized.page.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, {
          waitUntil: "domcontentloaded",
          timeout: 5000,
        });

        // Check if we got a 403 or error page
        const hasError =
          (await unauthorized.page.locator("text=/403|Forbidden|Access Denied/i").count()) > 0;
        connectionFailed = hasError;
      } catch (error) {
        connectionFailed = true;
      }

      // TODO: Implement proper authorization
      // For now, this test will fail - that's expected in TDD
      expect(connectionFailed).toBe(true);

      console.log("[TEST] ✅ Unauthorized user rejected");
    } finally {
      await cleanupYjs(owner.page);
      try {
        await cleanupYjs(unauthorized.page);
      } catch (e) {
        // May fail if page didn't load
      }
      await owner.context.close();
      await unauthorized.context.close();
    }
  });

  test("should persist multi-user edits to database", async ({ browser, request }) => {
    test.setTimeout(60000);

    const owner = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER_EMAIL,
      TEST_USER_PASSWORD
    );
    const editor = await createAuthenticatedPage(
      browser,
      request,
      TEST_USER2_EMAIL,
      TEST_USER2_PASSWORD
    );

    try {
      const fileId = 1;

      // Setup collaboration
      await openFileInEditor(owner.page, fileId);
      await clearEditor(owner.page);
      await owner.page.waitForTimeout(1000);

      await addCollaborator(fileId, editor.userId, "EDITOR", owner.token);
      await openFileInEditor(editor.page, fileId);

      // Both users edit
      await insertText(owner.page, "Line from owner\n");
      await insertText(editor.page, "Line from editor\n");

      // Wait for persistence
      await owner.page.waitForTimeout(1000);

      // Check database via API
      const response = await fetch(`http://localhost:${BACKEND_PORT}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${owner.token}` },
      });

      expect(response.ok).toBeTruthy();
      const fileData = await response.json();

      expect(fileData.source).toContain("Line from owner");
      expect(fileData.source).toContain("Line from editor");

      console.log("[TEST] ✅ Multi-user edits persisted to database");
    } finally {
      await cleanupYjs(owner.page);
      await cleanupYjs(editor.page);
      await owner.context.close();
      await editor.context.close();
    }
  });
});
