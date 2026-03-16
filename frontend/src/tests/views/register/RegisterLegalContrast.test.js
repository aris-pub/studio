import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const componentPath = resolve(__dirname, "../../../views/register/View.vue");
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

function extractColorToken(selector) {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${selectorEscaped}\\s*\\{[^}]*color:\\s*var\\((--[\\w-]+)\\)`, "s");
  const match = componentSrc.match(re);
  return match ? match[1] : null;
}

const WCAG_AA_SMALL_TEXT = 4.5;
const WHITE = "#FFFFFF";

describe("Register legal text: WCAG AA contrast", () => {
  describe(".form-legal body text", () => {
    const token = extractColorToken(".form-legal");

    it("uses an accessible color token (not gray-500 or gray-600)", () => {
      expect(token).toBeTruthy();
      expect(token).not.toBe("--gray-500");
      expect(token).not.toBe("--gray-600");
    });

    it(`meets WCAG AA ${WCAG_AA_SMALL_TEXT}:1 on white`, () => {
      const fg = resolveAlias(token);
      expect(fg).toBeTruthy();
      const ratio = contrastRatio(fg, WHITE);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
    });
  });

  describe(".form-legal a (link text)", () => {
    const token = extractColorToken(".form-legal a");

    it("uses an accessible color token (not gray-500 or gray-600 or gray-700)", () => {
      expect(token).toBeTruthy();
      expect(token).not.toBe("--gray-500");
      expect(token).not.toBe("--gray-600");
      expect(token).not.toBe("--gray-700");
    });

    it(`meets WCAG AA ${WCAG_AA_SMALL_TEXT}:1 on white`, () => {
      const fg = resolveAlias(token);
      expect(fg).toBeTruthy();
      const ratio = contrastRatio(fg, WHITE);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
    });
  });
});
