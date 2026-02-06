/**
 * E2E tests for Y.js - SINGLE USER, MULTIPLE TABS (Basic Sync Test)
 *
 * Simple integration test verifying basic tab-to-tab synchronization.
 * Tag: @auth
 *
 * Scope: studio-elz (Y.js: Same user, multiple tabs - self-collaboration)
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

const TEST_USER = {
  email: TEST_USER_EMAIL,
  password: TEST_USER_PASSWORD,
};

test.describe("Y.js Real-time Collaboration @auth", () => {
  test("should sync text edits between two tabs", async ({ browser, request }) => {
    test.setTimeout(60000);

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Listen for console errors
    page1.on("console", (msg) => {
      if (msg.type() === "error") console.log("[Tab1 Error]", msg.text());
    });
    page2.on("console", (msg) => {
      if (msg.type() === "error") console.log("[Tab2 Error]", msg.text());
    });

    try {
      // Login Tab 1
      console.log("[Test] Logging in Tab 1...");
      const loginResponse1 = await request.post(`http://localhost:${BACKEND_PORT}/login`, {
        data: TEST_USER,
      });
      expect(loginResponse1.ok()).toBeTruthy();
      const loginData1 = await loginResponse1.json();

      // Fetch user data for Tab 1
      const userResponse1 = await request.get(`http://localhost:${BACKEND_PORT}/me`, {
        headers: { Authorization: `Bearer ${loginData1.access_token}` },
      });
      expect(userResponse1.ok()).toBeTruthy();
      const userData1 = await userResponse1.json();

      // Login Tab 2
      console.log("[Test] Logging in Tab 2...");
      const loginResponse2 = await request.post(`http://localhost:${BACKEND_PORT}/login`, {
        data: TEST_USER,
      });
      expect(loginResponse2.ok()).toBeTruthy();
      const loginData2 = await loginResponse2.json();

      // Fetch user data for Tab 2
      const userResponse2 = await request.get(`http://localhost:${BACKEND_PORT}/me`, {
        headers: { Authorization: `Bearer ${loginData2.access_token}` },
      });
      expect(userResponse2.ok()).toBeTruthy();
      const userData2 = await userResponse2.json();

      // Use a known file ID for testing
      const fileId = 1;
      console.log(`[Test] Using file ID: ${fileId}`);

      // Open file in both tabs with auth
      console.log(`[Test] Setting up authentication for Tab 1...`);
      await page1.goto(`http://localhost:${FRONTEND_PORT}`, { waitUntil: "domcontentloaded" });
      await page1.evaluate((data) => {
        localStorage.setItem("accessToken", data.access_token);
        localStorage.setItem("refreshToken", data.refresh_token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }, { ...loginData1, user: userData1 });

      console.log(`[Test] Opening file ${fileId} in Tab 1...`);
      await page1.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, { waitUntil: "domcontentloaded" });

      console.log(`[Test] Setting up authentication for Tab 2...`);
      await page2.goto(`http://localhost:${FRONTEND_PORT}`, { waitUntil: "domcontentloaded" });
      await page2.evaluate((data) => {
        localStorage.setItem("accessToken", data.access_token);
        localStorage.setItem("refreshToken", data.refresh_token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }, { ...loginData2, user: userData2 });

      console.log(`[Test] Opening file ${fileId} in Tab 2...`);
      await page2.goto(`http://localhost:${FRONTEND_PORT}/file/${fileId}`, { waitUntil: "domcontentloaded" });

      // Open source editor in both tabs (same sequence as yjs-collaboration.spec.js)
      console.log("[Test] Opening source editor in Tab 1...");
      await page1.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });
      await page1.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
      await page1.waitForSelector(".cm-editor", { timeout: 5000 });
      await page1.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

      console.log("[Test] Opening source editor in Tab 2...");
      await page2.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });
      await page2.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
      await page2.waitForSelector(".cm-editor", { timeout: 5000 });
      await page2.waitForFunction(() => typeof window.__cmView !== "undefined", {}, { timeout: 5000 });

      // Wait for Y.js initial sync
      console.log("[Test] Waiting for Y.js sync...");
      await page1.waitForTimeout(1000);

      // Wait for editors to connect
      console.log("[Test] Waiting for editors to connect...");
      await expect(page1.locator(".status-indicator.connected")).toBeVisible({ timeout: 15000 });
      await expect(page2.locator(".status-indicator.connected")).toBeVisible({ timeout: 15000 });

      console.log("[Test] Both editors connected");
      await page1.waitForTimeout(2000);

      // Test sync from Tab 1 to Tab 2
      const testText = "\n\nTEST FROM TAB 1 - " + Date.now();
      console.log(`[Test] Typing in Tab 1: "${testText}"`);

      await page1.evaluate((text) => {
        const view = window.__cmView;
        if (view) {
          const docLength = view.state.doc.length;
          view.dispatch({
            changes: { from: docLength, insert: text },
          });
        }
      }, testText);

      await page2.waitForTimeout(2000);

      const tab2Content = await page2.evaluate(() => {
        return window.__cmView?.state.doc.toString() || "";
      });

      console.log(`[Test] Tab 2 content length: ${tab2Content.length} chars`);
      expect(tab2Content).toContain(testText);
      console.log("[Test] ✅ Tab 1 → Tab 2 sync works");

      // Test sync from Tab 2 to Tab 1
      const testText2 = "\n\nTEST FROM TAB 2 - " + Date.now();
      console.log(`[Test] Typing in Tab 2: "${testText2}"`);

      await page2.evaluate((text) => {
        const view = window.__cmView;
        if (view) {
          const docLength = view.state.doc.length;
          view.dispatch({
            changes: { from: docLength, insert: text },
          });
        }
      }, testText2);

      await page1.waitForTimeout(2000);

      const tab1Content = await page1.evaluate(() => {
        return window.__cmView?.state.doc.toString() || "";
      });

      expect(tab1Content).toContain(testText2);
      console.log("[Test] ✅ Tab 2 → Tab 1 sync works");

      console.log("[Test] ✅ ALL TESTS PASSED - Y.js real-time sync working");
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
