/**
 * Drift detection: ensures the committed syntax-highlights.css stays in sync
 * with the canonical source in tree-sitter-rsm.
 *
 * Canonical: ../../rsm/tree-sitter-rsm/queries/highlights.css
 * Copy:      src/assets/css/syntax-highlights.css
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CANONICAL = resolve(__dirname, "../../../../../rsm/tree-sitter-rsm/queries/highlights.css");
const COPY = resolve(__dirname, "../../assets/css/syntax-highlights.css");

describe("syntax-highlights.css drift detection", () => {
  it("matches the canonical tree-sitter-rsm highlights.css", () => {
    const canonical = readFileSync(CANONICAL, "utf-8");
    const copy = readFileSync(COPY, "utf-8");
    expect(copy).toBe(canonical);
  });
});
