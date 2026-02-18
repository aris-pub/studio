/**
 * E2E tests for Y.js - SINGLE USER, SINGLE TAB
 *
 * Tests basic Y.js functionality with one user in one browser tab.
 * Verifies Y.Doc initialization, WebSocket connection, and content persistence.
 *
 * Tag: @collab
 *
 * Scope: studio-can (Y.js: Single user, single tab editing)
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  clearEditor,
  insertText,
  typeInEditor,
  getEditorContent,
  getYTextContent,
  cleanupYjs,
} from "./yjs-helpers.js";

test.describe("Y.js Single User, Single Tab @collab", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test.describe("Basic Editing - No Duplication", () => {
    test("should not duplicate keystrokes when typing", async ({ browser, request }) => {
      const fileId = await createTestFile(request, auth.token, auth.userData.id);
      const { context, page } = await createAuthenticatedContext(browser, auth);
      try {
        await openFileInEditor(page, fileId);
        await clearEditor(page);

        // Type HELLO character by character
        const testString = "HELLO";
        for (let i = 0; i < testString.length; i++) {
          await typeInEditor(page, testString[i]);
          const content = await getEditorContent(page);
          const ytextContent = await getYTextContent(page);

          // Check no duplication after each character
          const expectedContent = testString.substring(0, i + 1);
          expect(content).toBe(expectedContent);
          expect(ytextContent).toBe(expectedContent);
        }

        const finalContent = await getEditorContent(page);
        const finalYTextContent = await getYTextContent(page);
        expect(finalContent).toBe("HELLO");
        expect(finalYTextContent).toBe("HELLO");
      } finally {
        await cleanupYjs(page);
        await context.close();
        await deleteTestFile(request, auth.token, fileId);
      }
    });

    test("should handle rapid typing without duplication", async ({ browser, request }) => {
      const fileId = await createTestFile(request, auth.token, auth.userData.id);
      const { context, page } = await createAuthenticatedContext(browser, auth);
      try {
        await openFileInEditor(page, fileId);
        await clearEditor(page);

        await insertText(page, "The quick brown fox jumps over the lazy dog");

        const content = await getEditorContent(page);
        const ytextContent = await getYTextContent(page);
        expect(content).toBe("The quick brown fox jumps over the lazy dog");
        expect(content.length).toBe(43);
        expect(ytextContent).toBe("The quick brown fox jumps over the lazy dog");
        expect(ytextContent.length).toBe(43);
      } finally {
        await cleanupYjs(page);
        await context.close();
        await deleteTestFile(request, auth.token, fileId);
      }
    });

    test("should handle delete operations correctly", async ({ browser, request }) => {
      const fileId = await createTestFile(request, auth.token, auth.userData.id);
      const { context, page } = await createAuthenticatedContext(browser, auth);
      try {
        await openFileInEditor(page, fileId);
        await clearEditor(page);

        await insertText(page, "Hello World");

        // Delete 'World'
        await page.evaluate(() => {
          const view = window.__cmView;
          view.dispatch({
            changes: { from: 6, to: 11, insert: "" },
          });
        });
        await page.waitForFunction(
          () =>
            window.__cmView.state.doc.toString() === "Hello " &&
            window.__ytext.toString() === "Hello ",
          {},
          { timeout: 5000 }
        );

        const content = await getEditorContent(page);
        const ytextContent = await getYTextContent(page);
        expect(content).toBe("Hello ");
        expect(ytextContent).toBe("Hello ");
      } finally {
        await cleanupYjs(page);
        await context.close();
        await deleteTestFile(request, auth.token, fileId);
      }
    });
  });

  test.describe("Performance", () => {
    test("should handle large document without lag", async ({ browser, request }) => {
      const fileId = await createTestFile(request, auth.token, auth.userData.id);
      const { context, page } = await createAuthenticatedContext(browser, auth);
      try {
        await openFileInEditor(page, fileId);
        await clearEditor(page);

        const largeText = "Line of text\n".repeat(100);
        const startTime = Date.now();

        await insertText(page, largeText);
        const duration = Date.now() - startTime;

        const content = await getEditorContent(page);
        const ytextContent = await getYTextContent(page);
        expect(content.split("\n").length).toBe(101); // 100 lines + empty line
        expect(duration).toBeLessThan(2000);
        expect(ytextContent).toBe(content);
        expect(ytextContent.split("\n").length).toBe(101);
      } finally {
        await cleanupYjs(page);
        await context.close();
        await deleteTestFile(request, auth.token, fileId);
      }
    });
  });
});
