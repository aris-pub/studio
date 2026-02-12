/**
 * E2E tests for Y.js - SINGLE USER, MULTIPLE TABS (Basic Sync Test)
 *
 * Simple integration test verifying basic tab-to-tab synchronization.
 * Tag: @auth
 *
 * Scope: studio-elz (Y.js: Same user, multiple tabs - self-collaboration)
 */

import { test, expect } from "@playwright/test";

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
};

test.describe("Y.js Real-time Collaboration @auth", () => {
  test("should sync text edits between two tabs", async ({ browser, request }) => {
    test.setTimeout(60000);

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Listen for console errors
    page1.on("console", (msg) => {});
    page2.on("console", (msg) => {});

    try {
      const backendURL = process.env.VITE_API_BASE_URL;

      // Login Tab 1
      const loginResponse1 = await request.post(`${backendURL}/login`, {
        data: TEST_USER,
      });
      expect(loginResponse1.ok()).toBeTruthy();
      const loginData1 = await loginResponse1.json();

      // Fetch user data for Tab 1
      const userResponse1 = await request.get(`${backendURL}/me`, {
        headers: { Authorization: `Bearer ${loginData1.access_token}` },
      });
      expect(userResponse1.ok()).toBeTruthy();
      const userData1 = await userResponse1.json();

      // Login Tab 2
      const loginResponse2 = await request.post(`${backendURL}/login`, {
        data: TEST_USER,
      });
      expect(loginResponse2.ok()).toBeTruthy();
      const loginData2 = await loginResponse2.json();

      // Fetch user data for Tab 2
      const userResponse2 = await request.get(`${backendURL}/me`, {
        headers: { Authorization: `Bearer ${loginData2.access_token}` },
      });
      expect(userResponse2.ok()).toBeTruthy();
      const userData2 = await userResponse2.json();

      // Use a known file ID for testing
      const fileId = 1;

      // Open file in both tabs with auth
      await page1.goto("/", { waitUntil: "domcontentloaded" });
      await page1.evaluate(
        (data) => {
          localStorage.setItem("accessToken", data.access_token);
          localStorage.setItem("refreshToken", data.refresh_token);
          localStorage.setItem("user", JSON.stringify(data.user));
        },
        { ...loginData1, user: userData1 }
      );

      await page1.goto(`/file/${fileId}`, {
        waitUntil: "domcontentloaded",
      });

      await page2.goto("/", { waitUntil: "domcontentloaded" });
      await page2.evaluate(
        (data) => {
          localStorage.setItem("accessToken", data.access_token);
          localStorage.setItem("refreshToken", data.refresh_token);
          localStorage.setItem("user", JSON.stringify(data.user));
        },
        { ...loginData2, user: userData2 }
      );

      await page2.goto(`/file/${fileId}`, {
        waitUntil: "domcontentloaded",
      });

      // Open source editor in both tabs (same sequence as yjs-collaboration.spec.js)
      await page1.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });
      await page1.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
      await page1.waitForSelector(".cm-editor", { timeout: 5000 });
      await page1.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      await page2.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });
      await page2.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
      await page2.waitForSelector(".cm-editor", { timeout: 5000 });
      await page2.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );

      // Wait for Y.js initial sync
      await page1.waitForTimeout(1000);

      // Wait for editors to connect
      await expect(page1.locator(".status-indicator.connected")).toBeVisible({ timeout: 15000 });
      await expect(page2.locator(".status-indicator.connected")).toBeVisible({ timeout: 15000 });

      await page1.waitForTimeout(2000);

      // Test sync from Tab 1 to Tab 2
      const testText = "\n\nTEST FROM TAB 1 - " + Date.now();

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

      expect(tab2Content).toContain(testText);

      // Test sync from Tab 2 to Tab 1
      const testText2 = "\n\nTEST FROM TAB 2 - " + Date.now();

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
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
