// @auth @auth-content
import { test, expect } from "../fixtures.js";
import { AuthHelpers } from "../utils/auth-helpers.js";
import { getBackendURL } from "../utils/test-config.js";

/**
 * Math Rendering Regression Tests
 *
 * RSM uses Temml as the primary math renderer (synchronous, native MathML).
 * MathJax is a fallback if the Temml CDN fails to load.
 *
 * These tests verify:
 * 1. Studio's onload injection runs exactly once (no infinite loop)
 * 2. Math elements do not duplicate when the source is edited and recompiled
 * 3. Tooltip interactions do not cause math duplication in the main document
 *
 * Each test creates a fresh file with math content to avoid dependencies on
 * existing test data.
 */

// RSM source with BOTH inline and block math - the math content is FIXED and
// edits are made to the TITLE LINE only, ensuring any math count increase is
// due to the duplication bug, not new math being added.
const RSM_SOURCE_WITH_MATH = `# Test Document for Math Bug

This document contains inline math $a^2 + b^2 = c^2$ and also $E = mc^2$ here.

Here is block math\\:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

And another block equation\\:

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$`;

test.describe("RSM Initialization Guard @auth @desktop-only", () => {
  let authHelpers;
  let baseURL;
  let accessToken;
  let testUserId;

  test.beforeEach(async ({ page }) => {
    baseURL = getBackendURL();
    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
    await page.waitForLoadState("networkidle").catch(() => {});
    accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));
    const userData = await page.evaluate(() => JSON.parse(localStorage.getItem("user")));
    testUserId = userData.id;
  });

  test.afterEach(async ({ page }) => {
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  async function createTestFile(request, source) {
    const createResponse = await request.post(`${baseURL}/files`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: "Init Guard Test", owner_id: testUserId, source },
    });
    if (!createResponse.ok()) {
      throw new Error(`File creation failed: ${createResponse.status()}`);
    }
    return (await createResponse.json()).id;
  }

  async function deleteTestFile(request, fileId) {
    try {
      await request.delete(`${baseURL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  test("RSM onload should only initialize once (no infinite import loop)", async ({
    page,
    request,
  }) => {
    // This test catches a bug where dynamic import() creates new module instances,
    // bypassing the initialization guard and causing infinite recursion / stack overflow.
    const source = `# Test\n\nInline math $x^2$ here.`;
    const fileId = await createTestFile(request, source);

    try {
      // Collect console messages to detect infinite loop
      const consoleLogs = [];
      page.on("console", (msg) => {
        if (msg.text().includes("onload initializing")) {
          consoleLogs.push(msg.text());
        }
      });

      // Collect errors to detect stack overflow
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(`/file/${fileId}`);

      // Wait for manuscript to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Wait for Temml to load (primary renderer)
      await page.waitForFunction(() => typeof window.temml !== "undefined", { timeout: 10000 });

      // Check the initialization guard is working
      const initState = await page.evaluate(() => ({
        rsmInitialized: window.__rsmInitialized,
        temmlExists: typeof window.temml !== "undefined",
        temmlScripts: document.querySelectorAll('script[src*="temml"]').length,
      }));

      // CRITICAL: onload should only initialize ONCE (catches infinite import loop)
      expect(consoleLogs.length).toBeLessThanOrEqual(1);

      // No stack overflow errors
      const stackOverflows = errors.filter((e) => e.includes("Maximum call stack"));
      expect(stackOverflows).toHaveLength(0);

      // Temml should have loaded successfully
      expect(initState.temmlExists).toBe(true);
      expect(initState.temmlScripts).toBe(1);

      if (initState.rsmInitialized !== undefined) {
        expect(initState.rsmInitialized).toBe(true);
      }
    } finally {
      await deleteTestFile(request, fileId);
    }
  });
});

test.describe("Math Duplication Bug @auth @desktop-only", () => {
  let authHelpers;
  let baseURL;
  let accessToken;
  let testUserId;

  test.beforeEach(async ({ page }) => {
    baseURL = getBackendURL();

    authHelpers = new AuthHelpers(page);
    await authHelpers.ensureLoggedIn();
    await page.waitForSelector('[data-testid="files-container"]', { timeout: 5000 });

    accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));

    const userData = await page.evaluate(() => JSON.parse(localStorage.getItem("user")));
    testUserId = userData.id;
  });

  async function createTestFileWithMath(request) {
    const createResponse = await request.post(`${baseURL}/files`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        title: "Math Bug Test File",
        owner_id: testUserId,
        source: RSM_SOURCE_WITH_MATH,
      },
    });

    if (!createResponse.ok()) {
      const errorText = await createResponse.text();
      throw new Error(`File creation failed: ${createResponse.status()} - ${errorText}`);
    }

    const fileData = await createResponse.json();
    return fileData.id;
  }

  async function deleteTestFile(request, fileId) {
    try {
      await request.delete(`${baseURL}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Wait for compiled content to appear in the manuscript viewer with math settled.
   *
   * After compile, Canvas destroys the old ManuscriptWrapper (via :key="file.html") and
   * creates a new one. During Vue's reconciliation both instances can briefly co-exist.
   * This waits until:
   *   1. Exactly one manuscript viewer exists AND it contains the expected new content
   *   2. Math elements are present (Temml has run on the new content)
   *
   * Temml is synchronous so there is no processing-state to poll.
   */
  async function waitForCompiledContent(page, contentMarker) {
    await page.waitForFunction(
      (marker) => {
        const viewers = document.querySelectorAll('[data-testid="manuscript-viewer"]');
        if (viewers.length !== 1) return false;
        if (!viewers[0].textContent?.includes(marker)) return false;
        const inline = document.querySelectorAll("span.math > math").length;
        const block = document.querySelectorAll("div.mathblock .hr-content-zone > math").length;
        return inline > 0 && block > 0;
      },
      contentMarker,
      { timeout: 15000 }
    );
  }

  /**
   * Wait for math rendering to stabilize by checking element counts.
   * Temml is synchronous, so stability is reached quickly.
   */
  async function waitForMathStable(page) {
    await page.waitForFunction(
      () => {
        const getState = () => ({
          inline: document.querySelectorAll("span.math > math").length,
          block: document.querySelectorAll("div.mathblock .hr-content-zone > math").length,
        });

        if (!window.__mathStabilityCheck) {
          window.__mathStabilityCheck = { state: getState(), stableCount: 0 };
          return false;
        }

        const current = getState();
        const prev = window.__mathStabilityCheck.state;

        if (current.inline === prev.inline && current.block === prev.block) {
          window.__mathStabilityCheck.stableCount++;
        } else {
          window.__mathStabilityCheck.stableCount = 0;
        }

        window.__mathStabilityCheck.state = current;
        return window.__mathStabilityCheck.stableCount >= 3;
      },
      { timeout: 5000, polling: 100 }
    );

    await page.evaluate(() => delete window.__mathStabilityCheck);
  }

  test("block math equations should not duplicate when editing source @flaky", async ({
    page,
    request,
  }) => {
    const fileId = await createTestFileWithMath(request);

    try {
      await page.goto(`/file/${fileId}`);

      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 5000,
      });

      // Wait for Temml to render both inline and block math
      await page.waitForFunction(
        () => {
          const inline = document.querySelectorAll("span.math > math").length;
          const block = document.querySelectorAll("div.mathblock .hr-content-zone > math").length;
          return inline > 0 && block > 0;
        },
        { timeout: 5000 }
      );

      await waitForMathStable(page);

      const initialCounts = await page.evaluate(() => ({
        inline: document.querySelectorAll("span.math > math").length,
        block: document.querySelectorAll("div.mathblock .hr-content-zone > math").length,
      }));

      // EXPECTED: 2 inline (span.math) + 2 block (div.mathblock)
      expect(initialCounts.inline).toBe(2);
      expect(initialCounts.block).toBe(2);

      // Open the source editor
      await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');

      await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
        timeout: 5000,
      });

      await page.waitForSelector(".cm-editor", { timeout: 5000 });
      await page.waitForFunction(
        () => typeof window.__cmView !== "undefined",
        {},
        { timeout: 5000 }
      );
      await page.waitForFunction(() => window.__provider?.synced === true, {}, { timeout: 5000 });

      const _currentContent = await page.evaluate(() => window.__cmView.state.doc.toString());

      await page.evaluate(() => {
        const view = window.__cmView;
        const doc = view.state.doc;
        const text = doc.toString();
        const newText = text.replace(
          "# Test Document for Math Bug",
          "# Test Document for Math Bug EDIT1"
        );
        view.dispatch({
          changes: { from: 0, to: doc.length, insert: newText },
        });
      });

      await page.waitForFunction(
        () => window.__ytext?.toString().includes("EDIT1"),
        {},
        { timeout: 5000 }
      );

      await page.click('button:has-text("compile")');

      await page.waitForResponse(
        (response) => response.url().includes("/render/private") && response.status() === 200,
        { timeout: 10000 }
      );

      const viewport = page.viewportSize();
      const isMobile = viewport && viewport.width < 640;
      if (isMobile) {
        const sourceButton = page.locator(".sb-item").filter({ hasText: "source" });
        await sourceButton.click();
        await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        });
      }

      await waitForCompiledContent(page, "EDIT1");

      const afterFirstEdit = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        if (!manuscript) return { error: "no manuscript viewer" };
        const text = manuscript.textContent || "";
        return {
          hasRawInlineLatex: text.includes("\\(") || text.includes("\\)"),
          hasRawBlockLatex: text.includes("$$"),
          titleCount: (text.match(/Test Document for Math Bug/g) || []).length,
          temmlScriptCount: document.querySelectorAll('script[src*="temml"]').length,
          inlineMathCount: document.querySelectorAll("span.math > math").length,
          blockMathCount: document.querySelectorAll("div.mathblock .hr-content-zone > math").length,
          nestedMathCount: document.querySelectorAll("math math").length,
        };
      });

      if (isMobile) {
        await page.click('[data-testid="workspace-sidebar"] .sb-item:has-text("source") button');
        await expect(page.locator('[data-testid="workspace-editor"]')).toBeVisible({
          timeout: 5000,
        });
        await page.waitForSelector(".cm-editor", { timeout: 5000 });
        await page.waitForFunction(
          () => typeof window.__cmView !== "undefined",
          {},
          { timeout: 5000 }
        );
      }

      const _currentContent2 = await page.evaluate(() => window.__cmView.state.doc.toString());

      await page.evaluate(() => {
        const view = window.__cmView;
        const doc = view.state.doc;
        const text = doc.toString();
        const newText = text.replace("EDIT1", "EDIT1 EDIT2");
        view.dispatch({
          changes: { from: 0, to: doc.length, insert: newText },
        });
      });

      await page.waitForFunction(
        () => window.__ytext?.toString().includes("EDIT2"),
        {},
        { timeout: 5000 }
      );

      await page.click('button:has-text("compile")');

      await page.waitForResponse(
        (response) => response.url().includes("/render/private") && response.status() === 200,
        { timeout: 10000 }
      );

      if (isMobile) {
        const sourceButton = page.locator(".sb-item").filter({ hasText: "source" });
        await sourceButton.click();
        await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        });
      }

      await waitForCompiledContent(page, "EDIT2");

      const afterSecondEdit = await page.evaluate(() => {
        const manuscript = document.querySelector('[data-testid="manuscript-viewer"]');
        const text = manuscript?.textContent || "";
        return {
          hasRawInlineLatex: text.includes("\\(") || text.includes("\\)"),
          hasRawBlockLatex: text.includes("$$"),
          titleCount: (text.match(/Test Document for Math Bug/g) || []).length,
          inlineMathCount: document.querySelectorAll("span.math > math").length,
          blockMathCount: document.querySelectorAll("div.mathblock .hr-content-zone > math").length,
          nestedMathCount: document.querySelectorAll("math math").length,
        };
      });

      // Raw LaTeX should never be visible
      expect(afterFirstEdit.hasRawInlineLatex).toBe(false);
      expect(afterFirstEdit.hasRawBlockLatex).toBe(false);
      expect(afterSecondEdit.hasRawInlineLatex).toBe(false);
      expect(afterSecondEdit.hasRawBlockLatex).toBe(false);

      // Title should appear exactly once
      expect(afterFirstEdit.titleCount).toBe(1);
      expect(afterSecondEdit.titleCount).toBe(1);

      // Only ONE Temml script tag
      expect(afterFirstEdit.temmlScriptCount).toBe(1);

      // math element counts should stay the same
      expect(afterFirstEdit.inlineMathCount).toBe(initialCounts.inline);
      expect(afterFirstEdit.blockMathCount).toBe(initialCounts.block);
      expect(afterSecondEdit.inlineMathCount).toBe(initialCounts.inline);
      expect(afterSecondEdit.blockMathCount).toBe(initialCounts.block);

      // No nested math elements (the duplication bug symptom)
      expect(afterFirstEdit.nestedMathCount).toBe(0);
      expect(afterSecondEdit.nestedMathCount).toBe(0);
    } finally {
      await deleteTestFile(request, fileId);
    }
  });
});
