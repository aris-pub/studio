import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderInlineMath } from "@/utils/renderInlineMath.js";

describe("renderInlineMath", () => {
  let originalTemml;

  beforeEach(() => {
    originalTemml = window.temml;
    window.temml = {
      renderToString: vi.fn((latex) => `<math>${latex}</math>`),
    };
  });

  afterEach(() => {
    window.temml = originalTemml;
  });

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
    expect(result).toBe("the value <math>x_e</math> is important");
    expect(window.temml.renderToString).toHaveBeenCalledWith("x_e", { displayMode: false });
  });

  it("renders multiple inline math expressions", () => {
    const result = renderInlineMath("$a$ and $b$");
    expect(result).toBe("<math>a</math> and <math>b</math>");
  });

  it("escapes HTML in non-math segments", () => {
    const result = renderInlineMath("<b>bold</b> $x$ text");
    expect(result).toBe("&lt;b&gt;bold&lt;/b&gt; <math>x</math> text");
  });

  it("falls back to escaped raw text when Temml throws", () => {
    window.temml.renderToString.mockImplementation(() => {
      throw new Error("parse error");
    });
    const result = renderInlineMath("bad $\\invalid$ math");
    expect(result).toBe("bad $\\invalid$ math");
  });

  it("falls back to full escapeHtml when window.temml is unavailable", () => {
    window.temml = undefined;
    const result = renderInlineMath("$x_e$ value");
    expect(result).toBe("$x_e$ value");
  });

  it("handles math at start and end of string", () => {
    const result = renderInlineMath("$a$ middle $b$");
    expect(result).toBe("<math>a</math> middle <math>b</math>");
  });

  it("does not match empty dollar signs $$", () => {
    const result = renderInlineMath("price is $$ dollars");
    expect(result).toBe("price is $$ dollars");
    expect(window.temml.renderToString).not.toHaveBeenCalled();
  });

  it("handles adjacent math expressions", () => {
    const result = renderInlineMath("$a$$b$");
    expect(result).toBe("<math>a</math><math>b</math>");
  });
});
