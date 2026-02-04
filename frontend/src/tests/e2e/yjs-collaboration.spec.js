/**
 * E2E tests for Y.js real-time collaboration
 *
 * Tests multi-user scenarios with real WebSocket connections
 * Tag: @collab
 */

import { test, expect } from '@playwright/test';

// Test user credentials
const TEST_USER_EMAIL = 'testuser@aris.pub';
const TEST_USER_PASSWORD = 'testpassword';

// Helper to create authenticated session
async function createAuthenticatedPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate and inject tokens
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(`
    localStorage.setItem('accessToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzcwMjIxNzM3fQ.mpcn96aimju7TOH-dSfZV34euEH1UQmTlnNcUWOMJ4c');
    localStorage.setItem('refreshToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzcwMjIxNzM3LCJ0eXBlIjoicmVmcmVzaCJ9.qourOZ_dTRY0Ou7K5wWSpM_8kLR6m52r-o7_2hqe6H4');
    localStorage.setItem('user', '{"email": "testuser@aris.pub", "id": 1, "name": "Test User", "initials": null, "created_at": "2026-02-03T16:15:02.946491+00:00", "avatar_color": null, "email_verified": false}');
  `);

  return { context, page };
}

// Helper to open file and editor
async function openFileInEditor(page, fileId) {
  await page.goto(`http://localhost:5173/file/${fileId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="manuscript-container"]', { timeout: 5000 });
  await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
  await page.waitForSelector('.cm-editor', { timeout: 5000 });
  // Wait for Y.js sync
  await page.waitForTimeout(2000);
}

// Helper to get editor content
async function getEditorContent(page) {
  return await page.evaluate('window.__cmView.state.doc.toString()');
}

// Helper to type in editor
async function typeInEditor(page, text) {
  await page.click('.cm-content');
  await page.waitForTimeout(200);
  await page.keyboard.press(text);
  await page.waitForTimeout(100);
}

// Helper to insert text programmatically
async function insertText(page, text) {
  await page.evaluate((txt) => {
    const view = window.__cmView;
    const pos = view.state.doc.length;
    view.dispatch({
      changes: { from: pos, insert: txt }
    });
  }, text);
}

// Helper to clear editor
async function clearEditor(page) {
  await page.evaluate(() => {
    const view = window.__cmView;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '' }
    });
  });
  await page.waitForTimeout(300);
}

test.describe('Y.js Collaboration @collab', () => {

  test.describe('Single User - No Duplication', () => {
    test('should not duplicate keystrokes when typing', async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        // Type HELLO character by character
        for (const char of 'HELLO') {
          await typeInEditor(page, char);
          const content = await getEditorContent(page);

          // Check no duplication after each character
          const expectedLength = 'HELLO'.indexOf(char) + 1;
          expect(content.length).toBe(expectedLength);
        }

        const finalContent = await getEditorContent(page);
        expect(finalContent).toBe('HELLO');
        expect(finalContent.length).toBe(5);

      } finally {
        await context.close();
      }
    });

    test('should handle rapid typing without duplication', async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        // Rapid insert
        await insertText(page, 'The quick brown fox jumps over the lazy dog');
        await page.waitForTimeout(500);

        const content = await getEditorContent(page);
        expect(content).toBe('The quick brown fox jumps over the lazy dog');
        expect(content.length).toBe(44);

      } finally {
        await context.close();
      }
    });

    test('should handle delete operations correctly', async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        await insertText(page, 'Hello World');
        await page.waitForTimeout(200);

        // Delete 'World'
        await page.evaluate(() => {
          const view = window.__cmView;
          view.dispatch({
            changes: { from: 6, to: 11, insert: '' }
          });
        });
        await page.waitForTimeout(200);

        const content = await getEditorContent(page);
        expect(content).toBe('Hello ');

      } finally {
        await context.close();
      }
    });
  });

  test.describe('Two Users - Bidirectional Sync', () => {
    test('should sync text from User A to User B', async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);
      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

        // User A types
        const testText = `User A: ${Date.now()}`;
        await insertText(userA.page, testText);
        await userB.page.waitForTimeout(1000);

        // User B should see User A's text
        const contentB = await getEditorContent(userB.page);
        expect(contentB).toContain(testText);

      } finally {
        await userA.context.close();
        await userB.context.close();
      }
    });

    test('should sync text from User B to User A', async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);
      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userB.page);
        await userA.page.waitForTimeout(500);

        // User B types
        const testText = `User B: ${Date.now()}`;
        await insertText(userB.page, testText);
        await userA.page.waitForTimeout(1000);

        // User A should see User B's text
        const contentA = await getEditorContent(userA.page);
        expect(contentA).toContain(testText);

      } finally {
        await userA.context.close();
        await userB.context.close();
      }
    });

    test('should handle bidirectional edits correctly', async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);
      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

        // User A types
        await insertText(userA.page, 'From A\n');
        await userB.page.waitForTimeout(500);

        // User B types
        await insertText(userB.page, 'From B\n');
        await userA.page.waitForTimeout(500);

        // Both should have both texts
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);

        expect(contentA).toContain('From A');
        expect(contentA).toContain('From B');
        expect(contentB).toContain('From A');
        expect(contentB).toContain('From B');
        expect(contentA).toBe(contentB);

      } finally {
        await userA.context.close();
        await userB.context.close();
      }
    });
  });

  test.describe('Three Users - Multi-Party Sync', () => {
    test('should sync between three users simultaneously', async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);
      const userB = await createAuthenticatedPage(browser);
      const userC = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);
        await openFileInEditor(userC.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);
        await userC.page.waitForTimeout(500);

        // Each user types
        await insertText(userA.page, 'A');
        await userB.page.waitForTimeout(500);
        await userC.page.waitForTimeout(500);

        await insertText(userB.page, 'B');
        await userA.page.waitForTimeout(500);
        await userC.page.waitForTimeout(500);

        await insertText(userC.page, 'C');
        await userA.page.waitForTimeout(500);
        await userB.page.waitForTimeout(500);

        // All should have ABC
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);
        const contentC = await getEditorContent(userC.page);

        expect(contentA).toContain('A');
        expect(contentA).toContain('B');
        expect(contentA).toContain('C');
        expect(contentA).toBe(contentB);
        expect(contentB).toBe(contentC);

      } finally {
        await userA.context.close();
        await userB.context.close();
        await userC.context.close();
      }
    });
  });

  test.describe('Concurrent Edits', () => {
    test('should handle simultaneous edits at different positions', async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);
      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

        // Set initial content
        await insertText(userA.page, 'START___END');
        await userB.page.waitForTimeout(500);

        // Both users edit simultaneously at different positions
        await Promise.all([
          userA.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({
              changes: { from: 5, to: 8, insert: 'MIDDLE' }
            });
          }),
          userB.page.evaluate(() => {
            const view = window.__cmView;
            view.dispatch({
              changes: { from: 0, to: 0, insert: 'BEGIN-' }
            });
          })
        ]);

        await userA.page.waitForTimeout(1000);
        await userB.page.waitForTimeout(1000);

        // Both should have converged (order might vary due to OT)
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);

        expect(contentA).toBe(contentB);
        expect(contentA).toContain('BEGIN');
        expect(contentA).toContain('START');
        expect(contentA).toContain('END');

      } finally {
        await userA.context.close();
        await userB.context.close();
      }
    });

    test('should handle conflicting edits at same position', async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);
      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

        // Both users insert at position 0 simultaneously
        await Promise.all([
          insertText(userA.page, 'A'),
          insertText(userB.page, 'B')
        ]);

        await userA.page.waitForTimeout(1000);
        await userB.page.waitForTimeout(1000);

        // Should converge to same state (Y.js CRDT resolution)
        const contentA = await getEditorContent(userA.page);
        const contentB = await getEditorContent(userB.page);

        expect(contentA).toBe(contentB);
        expect(contentA.length).toBe(2);
        expect(contentA).toMatch(/^[AB][AB]$/);

      } finally {
        await userA.context.close();
        await userB.context.close();
      }
    });
  });

  test.describe('Reconnection Handling', () => {
    test('should sync after disconnect and reconnect', async ({ browser }) => {
      const userA = await createAuthenticatedPage(browser);
      const userB = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(userA.page, 1);
        await openFileInEditor(userB.page, 1);

        await clearEditor(userA.page);
        await userB.page.waitForTimeout(500);

        // User A types
        await insertText(userA.page, 'Before disconnect');
        await userB.page.waitForTimeout(500);

        // User B navigates away (simulates disconnect)
        await userB.page.goto('http://localhost:5173/');
        await userB.page.waitForTimeout(500);

        // User A types more
        await insertText(userA.page, '\nDuring disconnect');
        await userA.page.waitForTimeout(500);

        // User B reconnects
        await openFileInEditor(userB.page, 1);
        await userB.page.waitForTimeout(1000);

        // User B should have all content
        const contentB = await getEditorContent(userB.page);
        expect(contentB).toContain('Before disconnect');
        expect(contentB).toContain('During disconnect');

      } finally {
        await userA.context.close();
        await userB.context.close();
      }
    });
  });

  test.describe('Performance', () => {
    test('should handle large document without lag', async ({ browser }) => {
      const { context, page } = await createAuthenticatedPage(browser);

      try {
        await openFileInEditor(page, 1);
        await clearEditor(page);

        // Insert large text
        const largeText = 'Line of text\n'.repeat(100);
        const startTime = Date.now();

        await insertText(page, largeText);
        await page.waitForTimeout(500);

        const endTime = Date.now();
        const duration = endTime - startTime;

        const content = await getEditorContent(page);
        expect(content.split('\n').length).toBe(101); // 100 lines + empty line
        expect(duration).toBeLessThan(2000); // Should be fast

      } finally {
        await context.close();
      }
    });
  });
});
