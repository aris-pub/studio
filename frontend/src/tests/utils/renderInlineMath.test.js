import { describe, it, expect } from "vitest";
import { renderInlineMath } from "@/utils/renderInlineMath.js";

describe("renderInlineMath", () => {
  it("returns empty string for falsy input", () => {
    expect(renderInlineMath("")).toBe("");
    expect(renderInlineMath(null)).toBe("");
    expect(renderInlineMath(undefined)).toBe("");
  });

  it("returns escaped text when no math delimiters present", () => {
    expect(renderInlineMath("plain text")).toBe("plain text");
    expect(renderInlineMath("a < b & c")).toBe("a &lt; b &amp; c");
  });

  it("renders single inline math expression", () => {
    const result = renderInlineMath("the value $x_e$ is important");
    expect(result).toContain("katex");
    expect(result).toMatch(/the value .+katex.+ is important/s);
  });

  it("renders multiple inline math expressions", () => {
    const result = renderInlineMath("$a$ and $b$");
    expect(result).toContain("katex");
    expect(result).toContain(" and ");
  });

  it("escapes HTML in non-math segments", () => {
    const result = renderInlineMath("<b>bold</b> $x$ text");
    expect(result).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(result).toContain("katex");
  });

  it("renders invalid LaTeX gracefully with throwOnError: false", () => {
    const result = renderInlineMath("bad $\\invalid$ math");
    // KaTeX with throwOnError: false renders an error span instead of throwing
    expect(result).toContain("bad ");
    expect(result).toContain(" math");
  });

  it("handles math at start and end of string", () => {
    const result = renderInlineMath("$a$ middle $b$");
    expect(result).toContain("katex");
    expect(result).toContain(" middle ");
  });

  it("does not match empty dollar signs $$", () => {
    const result = renderInlineMath("price is $$ dollars");
    expect(result).toBe("price is $$ dollars");
  });

  it("handles adjacent math expressions", () => {
    const result = renderInlineMath("$a$$b$");
    expect(result).toContain("katex");
    // Should contain two rendered math expressions
    const katexCount = (result.match(/katex-mathml/g) || []).length;
    expect(katexCount).toBe(2);
  });
});
