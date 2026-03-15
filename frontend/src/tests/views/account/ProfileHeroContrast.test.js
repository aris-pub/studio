import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const componentPath = resolve(__dirname, "../../../views/account/View.vue");
const componentSrc = readFileSync(componentPath, "utf-8");

const cssPath = resolve(__dirname, "../../../../../site/assets/css/rsm.css");
const css = readFileSync(cssPath, "utf-8");

function parseHex(hex) {
  hex = hex.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolveToken(tokenName) {
  const re = new RegExp(
    `${tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(#[0-9A-Fa-f]{6})`
  );
  const match = css.match(re);
  return match ? match[1] : null;
}

function resolveAlias(tokenName) {
  const re = new RegExp(
    `${tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*var\\((--[\\w-]+)\\)`
  );
  const match = css.match(re);
  if (match) return resolveToken(match[1]);
  return resolveToken(tokenName);
}

const WCAG_AA_SMALL_TEXT = 4.5;

function extractColorToken(selector) {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${selectorEscaped}\\s*\\{[^}]*color:\\s*var\\((--[\\w-]+)\\)`, "s");
  const match = componentSrc.match(re);
  return match ? match[1] : null;
}

describe("Account hero section: WCAG AA contrast", () => {
  const bgToken1 = "--information-50";
  const bgToken2 = "--information-100";
  const bg1 = resolveAlias(bgToken1);
  const bg2 = resolveAlias(bgToken2);

  it("resolves background tokens to hex values", () => {
    expect(bg1).toBeTruthy();
    expect(bg2).toBeTruthy();
  });

  describe.each([
    [".member-since", 13],
    [".user-email", 16],
  ])("%s text (%dpx)", (selector, _fontSize) => {
    const token = extractColorToken(selector);

    it(`uses an accessible color token (not gray-500 or gray-600)`, () => {
      expect(token).toBeTruthy();
      expect(token).not.toBe("--gray-500");
      expect(token).not.toBe("--gray-600");
    });

    it(`meets WCAG AA ${WCAG_AA_SMALL_TEXT}:1 on ${bgToken1}`, () => {
      const fg = resolveAlias(token);
      expect(fg).toBeTruthy();
      const ratio = contrastRatio(fg, bg1);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
    });

    it(`meets WCAG AA ${WCAG_AA_SMALL_TEXT}:1 on ${bgToken2}`, () => {
      const fg = resolveAlias(token);
      expect(fg).toBeTruthy();
      const ratio = contrastRatio(fg, bg2);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
    });
  });
});
