/**
 * E2E regression: content must NOT duplicate across repeated reconnect cycles.
 *
 * This is the production trigger for the content-duplication class (epic
 * std-vopw): a document open across multiple backend reconnects / multi-player
 * room teardowns. Historically the backend re-seeded plaintext into a fresh Doc
 * on each reconnect, minting new CRDT identity that merged into duplicate copies
 * (1x -> 2x -> 4x -> 8x). The fix persists encoded CRDT state and restores it
 * idempotently.
 *
 * The existing @collab specs assert with `toContain`, which passes on
 * "X\nX\nX\nX" and therefore CANNOT detect duplication. This spec asserts EXACT
 * counts (match().length === 1) in both the live editor and the DB after every
 * reconnect, so any doubling fails immediately.
 *
 * Tag: @collab
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
  getYTextContent,
  cleanupYjs,
} from "./yjs-helpers.js";
import { getBackendURL } from "./utils/test-config.js";

const backendURL = getBackendURL();

async function getFileSource(fileId, token) {
  const res = await fetch(`${backendURL}/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return (await res.json()).source ?? "";
}

async function waitForDbContains(fileId, token, marker, { timeout = 8000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await getFileSource(fileId, token)).includes(marker)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`DB never contained marker "${marker}" within ${timeout}ms`);
}

function countOccurrences(haystack, marker) {
  return (haystack.match(new RegExp(marker, "g")) || []).length;
}

test.describe("Y.js Reconnect - No Duplication @collab", () => {
  let auth;

  test.beforeAll(async ({ request }) => {
    auth = await loginUser(request);
  });

  test("content stays single-copy across repeated reconnect cycles @collab", async ({
    browser,
    request,
  }) => {
    test.setTimeout(180000);
    const fileId = await createTestFile(request, auth.token, auth.userData.id);
    const marker = `RECONNECT-DUP-MARKER-${Date.now()}`;
    const content = `# ${marker}\n\nThis unique line must never duplicate on reconnect.`;

    let session = await createAuthenticatedContext(browser, auth);
    try {
      await openFileInEditor(session.page, fileId);
      await clearEditor(session.page);
      await insertText(session.page, content);
      await waitForDbContains(fileId, auth.token, marker);

      const CYCLES = 5;
      for (let cycle = 1; cycle <= CYCLES; cycle++) {
        // Tear down the last frontend -> multi-player kills the room (code 4000)
        // -> backend reconnects to an empty room and restores from ydoc_state.
        await cleanupYjs(session.page);
        await session.context.close();
        // Let the WS connections and room teardown settle (backend-side event,
        // no browser signal to wait on).
        await new Promise((r) => setTimeout(r, 1200));

        session = await createAuthenticatedContext(browser, auth);
        await openFileInEditor(session.page, fileId);

        // Wait until the restored content is present in the editor's Y.Text.
        await session.page.waitForFunction(
          (m) => (window.__ytext?.toString() || "").includes(m),
          marker,
          { timeout: 15000 }
        );

        const editorText = await getYTextContent(session.page);
        expect(
          countOccurrences(editorText, marker),
          `editor Y.Text after reconnect cycle ${cycle}`
        ).toBe(1);

        const dbSource = await getFileSource(fileId, auth.token);
        expect(
          countOccurrences(dbSource, marker),
          `DB source after reconnect cycle ${cycle}`
        ).toBe(1);
      }
    } finally {
      await cleanupYjs(session.page);
      await session.context.close();
      await deleteTestFile(request, auth.token, fileId);
    }
  });
});
