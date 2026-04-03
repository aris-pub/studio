import { describe, it, expect } from "vitest";
import { positionToOffset, severityToString } from "@/composables/useLSPDiagnostics.js";

/**
 * Build a minimal CodeMirror-compatible doc mock from a string.
 * Mirrors the Text interface: .lines, .line(n) returns {from, to, text}.
 */
function mockDoc(text) {
  const lineTexts = text.split("\n");
  const lineData = [];
  let offset = 0;
  for (const lt of lineTexts) {
    lineData.push({ from: offset, to: offset + lt.length, text: lt });
    offset += lt.length + 1; // +1 for the newline
  }
  return {
    lines: lineData.length,
    line(n) {
      return lineData[n - 1]; // CodeMirror lines are 1-based
    },
  };
}

describe("positionToOffset", () => {
  it("converts line 0, character 0 to offset 0", () => {
    const doc = mockDoc("hello\nworld");
    expect(positionToOffset(doc, { line: 0, character: 0 })).toBe(0);
  });

  it("converts a character offset within the first line", () => {
    const doc = mockDoc("hello\nworld");
    expect(positionToOffset(doc, { line: 0, character: 3 })).toBe(3);
  });

  it("converts line 1, character 0 to the start of the second line", () => {
    const doc = mockDoc("hello\nworld");
    // "hello" is 5 chars + 1 newline = offset 6
    expect(positionToOffset(doc, { line: 1, character: 0 })).toBe(6);
  });

  it("converts a position in the middle of a later line", () => {
    const doc = mockDoc("hello\nworld\nfoo bar");
    // line 2 starts at 6+6=12, character 4 → offset 16
    expect(positionToOffset(doc, { line: 2, character: 4 })).toBe(16);
  });

  it("handles lines of varying lengths correctly", () => {
    const doc = mockDoc("ab\ncdefgh\ni");
    // line 0: from=0, to=2
    // line 1: from=3, to=9
    // line 2: from=10, to=11
    expect(positionToOffset(doc, { line: 1, character: 5 })).toBe(8);
    expect(positionToOffset(doc, { line: 2, character: 0 })).toBe(10);
  });

  it("clamps character to end of line when it exceeds line length", () => {
    const doc = mockDoc("hi\nbye");
    // line 0 is "hi" (to=2), character 99 should clamp to 2
    expect(positionToOffset(doc, { line: 0, character: 99 })).toBe(2);
  });

  it("returns null for a line number beyond the document", () => {
    const doc = mockDoc("only one line");
    expect(positionToOffset(doc, { line: 5, character: 0 })).toBeNull();
  });

  it("returns null for negative line numbers", () => {
    const doc = mockDoc("hello");
    // line: -1 → lineNumber = 0, which is < 1
    expect(positionToOffset(doc, { line: -1, character: 0 })).toBeNull();
  });

  it("handles an empty document (single empty line)", () => {
    const doc = mockDoc("");
    expect(positionToOffset(doc, { line: 0, character: 0 })).toBe(0);
    expect(positionToOffset(doc, { line: 1, character: 0 })).toBeNull();
  });

  it("differs from the old 80-char heuristic for short lines", () => {
    // The old code did: line * 80 + character
    // For "ab\ncd" with position {line:1, character:1}, old code gives 81, correct is 4
    const doc = mockDoc("ab\ncd");
    const result = positionToOffset(doc, { line: 1, character: 1 });
    expect(result).toBe(4);
    expect(result).not.toBe(1 * 80 + 1);
  });
});

describe("severityToString", () => {
  it("maps LSP severity 1 to 'error'", () => {
    expect(severityToString(1)).toBe("error");
  });

  it("maps LSP severity 2 to 'warning'", () => {
    expect(severityToString(2)).toBe("warning");
  });

  it("maps LSP severity 3 to 'info'", () => {
    expect(severityToString(3)).toBe("info");
  });

  it("maps LSP severity 4 to 'hint'", () => {
    expect(severityToString(4)).toBe("hint");
  });

  it("defaults to 'error' for unknown severity", () => {
    expect(severityToString(undefined)).toBe("error");
    expect(severityToString(0)).toBe("error");
    expect(severityToString(99)).toBe("error");
  });
});
