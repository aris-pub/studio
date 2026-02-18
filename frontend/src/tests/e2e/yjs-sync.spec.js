/**
 * E2E tests for Y.js - SINGLE USER, MULTIPLE TABS (Basic Sync Test)
 *
 * Simple integration test verifying basic tab-to-tab synchronization.
 * Tag: @auth
 *
 * Scope: studio-elz (Y.js: Same user, multiple tabs - self-collaboration)
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  cleanupYjs,
} from "./yjs-helpers.js";

test.describe("Y.js Real-time Collaboration @auth", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("should sync text edits between two tabs", async ({ browser, request }) => {
    test.setTimeout(60000);

    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const tab1 = await createAuthenticatedContext(browser, auth);
    const tab2 = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(tab1.page, fileId);
      await openFileInEditor(tab2.page, fileId);

      // Test sync from Tab 1 to Tab 2
      const testText = "TEST FROM TAB 1 - " + Date.now();
      await tab1.page.evaluate((text) => {
        const view = window.__cmView;
        view.dispatch({ changes: { from: view.state.doc.length, insert: "\n\n" + text } });
      }, testText);

      await tab2.page.waitForFunction(
        (text) => window.__cmView?.state.doc.toString().includes(text),
        testText,
        { timeout: 10000 }
      );
      expect(await tab2.page.evaluate(() => window.__cmView.state.doc.toString())).toContain(
        testText
      );

      // Test sync from Tab 2 to Tab 1
      const testText2 = "TEST FROM TAB 2 - " + Date.now();
      await tab2.page.evaluate((text) => {
        const view = window.__cmView;
        view.dispatch({ changes: { from: view.state.doc.length, insert: "\n\n" + text } });
      }, testText2);

      await tab1.page.waitForFunction(
        (text) => window.__cmView?.state.doc.toString().includes(text),
        testText2,
        { timeout: 10000 }
      );
      expect(await tab1.page.evaluate(() => window.__cmView.state.doc.toString())).toContain(
        testText2
      );
    } finally {
      await cleanupYjs(tab1.page).catch(() => {});
      await cleanupYjs(tab2.page).catch(() => {});
      await tab1.context.close();
      await tab2.context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
