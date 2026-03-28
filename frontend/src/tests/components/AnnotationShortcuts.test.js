/**
 * Tests for keyboard shortcuts for annotation creation.
 *
 * - Cmd+Shift+H — Mark (highlight only)
 * - Cmd+Alt+M — Note (private, opens edit)
 * - Cmd+Alt+C — Comment (shared, opens edit)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const viewSource = readFileSync(
  resolve(__dirname, "../../views/workspace/View.vue"),
  "utf-8",
);
const viewScript =
  viewSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";

describe("Annotation keyboard shortcuts", () => {
  it("registers a keydown listener for annotation shortcuts", () => {
    expect(viewScript).toMatch(/addEventListener.*keydown.*handleAnnotationShortcut/);
  });

  it("removes the keydown listener on unmount", () => {
    expect(viewScript).toMatch(/removeEventListener.*keydown.*handleAnnotationShortcut/);
  });

  it("handles Cmd+Shift+H for mark (highlight)", () => {
    // Should check metaKey && shiftKey && key === "h" (or "H")
    expect(viewScript).toMatch(/shiftKey[\s\S]*?["']h["']/i);
    expect(viewScript).toMatch(/createAnnotation/);
  });

  it("handles Cmd+Shift+M for note (private)", () => {
    expect(viewScript).toMatch(/shiftKey[\s\S]*?["']m["']/i);
    expect(viewScript).toMatch(/private/);
  });

  it("handles Cmd+Shift+K for comment (shared)", () => {
    expect(viewScript).toMatch(/shiftKey[\s\S]*?["']k["']/i);
    expect(viewScript).toMatch(/shared/);
  });

  it("extracts anchor from current selection", () => {
    expect(viewScript).toMatch(/getSelection/);
    expect(viewScript).toMatch(/extractSourceAnchor|extractAnchor/);
  });

  it("sets activeAnnotationId for note and comment to open the card", () => {
    expect(viewScript).toMatch(/activeAnnotationId\.value = .*\.id/);
  });

  it("prevents default on matched shortcuts", () => {
    expect(viewScript).toMatch(/preventDefault/);
  });
});
