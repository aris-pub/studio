import { describe, it, expect } from "vitest";
import { findBreadcrumbPath } from "@/composables/useDocumentBreadcrumbs.js";

// LSP SymbolKind constants
const SymbolKind = {
  File: 1,
  Module: 2,
  Namespace: 3,
  Class: 5,
  Method: 6,
  Function: 12,
  String: 15,
};

function sym(name, kind, startLine, startChar, endLine, endChar, children = []) {
  return {
    name,
    kind,
    range: {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    },
    children,
  };
}

const DOC_TEXT = [
  "# Title", // line 0, length 7
  "", // line 1, length 0
  "## Section 1", // line 2, length 12
  "", // line 3, length 0
  "Some paragraph.", // line 4, length 15
  "", // line 5, length 0
  "## Section 2", // line 6, length 12
  "", // line 7, length 0
  "More content.", // line 8, length 13
].join("\n");

describe("findBreadcrumbPath", () => {
  it("returns empty array when symbols is empty", () => {
    expect(findBreadcrumbPath([], 0, DOC_TEXT)).toEqual([]);
  });

  it("returns empty array when symbols is null", () => {
    expect(findBreadcrumbPath(null, 0, DOC_TEXT)).toEqual([]);
  });

  it("returns single crumb for cursor inside a flat symbol", () => {
    const symbols = [
      sym("Section 1", SymbolKind.Namespace, 2, 0, 5, 0),
      sym("Section 2", SymbolKind.Namespace, 6, 0, 8, 13),
    ];
    // Cursor at line 4, char 5 = "Some paragraph." middle
    // Offset: line0(8) + line1(1) + line2(13) + line3(1) + 5 = 28
    const offset = 8 + 1 + 13 + 1 + 5;
    const result = findBreadcrumbPath(symbols, offset, DOC_TEXT);
    expect(result).toMatchObject([{ name: "Section 1", kind: SymbolKind.Namespace }]);
  });

  it("returns nested crumbs for cursor inside nested symbols", () => {
    const innerSym = sym("Paragraph", SymbolKind.String, 4, 0, 4, 15);
    const outerSym = sym("Section 1", SymbolKind.Namespace, 2, 0, 5, 0, [innerSym]);
    const symbols = [outerSym];

    // Cursor at line 4, char 3
    const offset = 8 + 1 + 13 + 1 + 3;
    const result = findBreadcrumbPath(symbols, offset, DOC_TEXT);
    expect(result).toMatchObject([
      { name: "Section 1", kind: SymbolKind.Namespace },
      { name: "Paragraph", kind: SymbolKind.String },
    ]);
  });

  it("returns empty when cursor is outside all symbols", () => {
    const symbols = [sym("Section 1", SymbolKind.Namespace, 2, 0, 5, 0)];
    // Cursor at line 0 (Title, before Section 1)
    const result = findBreadcrumbPath(symbols, 0, DOC_TEXT);
    expect(result).toEqual([]);
  });

  it("handles cursor at exact start of symbol range", () => {
    const symbols = [sym("Section 2", SymbolKind.Namespace, 6, 0, 8, 13)];
    // Offset at line 6, char 0
    const offset = 8 + 1 + 13 + 1 + 16 + 1 + 13 + 1; // = 54
    const result = findBreadcrumbPath(symbols, offset, DOC_TEXT);
    expect(result).toMatchObject([{ name: "Section 2", kind: SymbolKind.Namespace }]);
  });

  it("handles cursor at exact end of symbol range", () => {
    const symbols = [sym("Section 2", SymbolKind.Namespace, 6, 0, 8, 13)];
    // Offset at line 8, char 13 (end of doc)
    const offset = DOC_TEXT.length;
    const result = findBreadcrumbPath(symbols, offset, DOC_TEXT);
    expect(result).toMatchObject([{ name: "Section 2", kind: SymbolKind.Namespace }]);
  });

  it("returns deepest matching path with multiple nesting levels", () => {
    const leaf = sym("Claim", SymbolKind.Function, 4, 0, 4, 10);
    const mid = sym("Proof", SymbolKind.Method, 3, 0, 5, 0, [leaf]);
    const outer = sym("Theorem 1", SymbolKind.Class, 2, 0, 5, 0, [mid]);
    const symbols = [outer];

    const offset = 8 + 1 + 13 + 1 + 3;
    const result = findBreadcrumbPath(symbols, offset, DOC_TEXT);
    expect(result).toMatchObject([
      { name: "Theorem 1", kind: SymbolKind.Class },
      { name: "Proof", kind: SymbolKind.Method },
      { name: "Claim", kind: SymbolKind.Function },
    ]);
  });
});
