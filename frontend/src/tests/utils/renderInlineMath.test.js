import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderInlineMath } from "@/utils/renderInlineMath.js";

// Mock window.temml with a minimal renderToString that produces MathML
const mockTemml = {
  renderToString(latex, opts) {
    if (latex.startsWith("\\invalid")) {
      throw new Error("Invalid LaTeX");
    }
    return `<math><mi>${latex}</mi></math>`;
  },
};

beforeAll(() => {
  window.temml = mockTemml;
});

afterAll(() => {
  delete window.temml;
});

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
    expect(result).toContain("<math");
    expect(result).toMatch(/the value .*<math.+ is important/s);
  });

  it("renders multiple inline math expressions", () => {
    const result = renderInlineMath("$a$ and $b$");
    expect(result).toContain("<math");
    expect(result).toContain(" and ");
  });

  it("escapes HTML in non-math segments", () => {
    const result = renderInlineMath("<b>bold</b> $x$ text");
    expect(result).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(result).toContain("<math");
  });

  it("renders invalid LaTeX gracefully", () => {
    const result = renderInlineMath("bad $\\invalid$ math");
    expect(result).toContain("bad ");
    expect(result).toContain(" math");
  });

  it("handles math at start and end of string", () => {
    const result = renderInlineMath("$a$ middle $b$");
    expect(result).toContain("<math");
    expect(result).toContain(" middle ");
  });

  it("does not match empty dollar signs $$", () => {
    const result = renderInlineMath("price is $$ dollars");
    expect(result).toBe("price is $$ dollars");
  });

  it("handles adjacent math expressions", () => {
    const result = renderInlineMath("$a$$b$");
    expect(result).toContain("<math");
    const mathCount = (result.match(/<math/g) || []).length;
    expect(mathCount).toBe(2);
  });

  it("falls back to escaped text when temml is not available", () => {
    const saved = window.temml;
    delete window.temml;
    const result = renderInlineMath("see $x^2$ here");
    expect(result).toBe("see $x^2$ here");
    expect(result).not.toContain("<math");
    window.temml = saved;
  });
});
