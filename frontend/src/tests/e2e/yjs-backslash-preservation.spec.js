/**
 * E2E regression test for Y.js BACKSLASH PRESERVATION
 *
 * Reproduces a bug where LaTeX backslashes (e.g. \int_0^\infty) were doubled
 * to \\int_0^\\infty in the Y.js editor. The root cause was a room name
 * mismatch: backend used `file-{id}-local` while frontend used `file-{id}-dev`,
 * so the backend never connected to the same Y.js room. Without a backend peer,
 * the frontend re-seeded from DB on every connect, and the JSON round-trip
 * doubled every backslash.
 *
 * Tag: @collab
 *
 * Scope: LaTeX backslash fidelity through Y.js sync
 */

import { test, expect } from "./fixtures.js";
import {
  loginUser,
  createTestFile,
  deleteTestFile,
  createAuthenticatedContext,
  openFileInEditor,
  getYTextContent,
  cleanupYjs,
} from "./yjs-helpers.js";

const LATEX_SOURCE = [
  "# Backslash Preservation Test",
  "",
  "Consider the integral",
  "",
  "$$",
  "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
  "$$",
  "",
  "and the sum",
  "",
  "$$",
  "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",
  "$$",
].join("\n");

test.describe("Y.js Backslash Preservation @collab", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("LaTeX backslashes should not be doubled after Y.js sync", async ({ browser, request }) => {
    test.setTimeout(60000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id, LATEX_SOURCE);
    const { context, page } = await createAuthenticatedContext(browser, auth);

    try {
      await openFileInEditor(page, fileId);

      const ytextContent = await getYTextContent(page);

      // No double backslashes anywhere in the document
      expect(ytextContent).not.toContain("\\\\");

      // Length must match the original source exactly
      expect(ytextContent.length).toBe(LATEX_SOURCE.length);

      // Specific LaTeX commands preserved with single backslashes
      expect(ytextContent).toContain("\\int_0^\\infty");
      expect(ytextContent).toContain("\\frac");
      expect(ytextContent).toContain("\\sqrt");
      expect(ytextContent).toContain("\\sum");
      expect(ytextContent).toContain("\\pi");
    } finally {
      await cleanupYjs(page);
      await context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
