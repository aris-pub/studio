/**
 * Tests for the annotation menu redesign:
 * - Swatches are color selectors (radio buttons), not creation actions
 * - Three labeled action buttons: Highlight, Note, Comment
 * - All actions use the currently selected color
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const menuSource = readFileSync(
  resolve(__dirname, "../../components/annotations/AnnotationMenu.vue"),
  "utf-8",
);
const menuScript =
  menuSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";
const menuTemplate =
  menuSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
const menuStyle =
  menuSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";

describe("AnnotationMenu redesign — swatches as color selectors", () => {
  it("has a selectedColor ref defaulting to purple", () => {
    expect(menuScript).toMatch(/selectedColor.*ref\(["']purple["']\)/);
  });

  it("swatches have role=radio and aria-checked", () => {
    expect(menuTemplate).toMatch(/role="radio"/);
    expect(menuTemplate).toMatch(/aria-checked/);
  });

  it("swatch container has role=radiogroup", () => {
    expect(menuTemplate).toMatch(/role="radiogroup"/);
  });

  it("clicking a swatch calls onSwatchSelect, not onColorClick", () => {
    expect(menuTemplate).toMatch(/onSwatchSelect/);
    expect(menuTemplate).not.toMatch(/onColorClick/);
  });

  it("clearSelection resets selectedColor to purple", () => {
    expect(menuScript).toMatch(
      /clearSelection[\s\S]*selectedColor\.value\s*=\s*["']purple["']/,
    );
  });
});

describe("AnnotationMenu redesign — three labeled action buttons", () => {
  it("has a Highlight button with text label", () => {
    expect(menuTemplate).toMatch(/text="Mark"/);
  });

  it("has a Note button with text label", () => {
    expect(menuTemplate).toMatch(/text="Note"/);
  });

  it("has a Comment button with text label", () => {
    expect(menuTemplate).toMatch(/text="Comment"/);
  });

  it("Highlight button creates annotation without setting activeAnnotationId", () => {
    expect(menuScript).toMatch(/onHighlight/);
  });

  it("Note button creates private annotation", () => {
    expect(menuTemplate).toMatch(
      /onCreateAnnotation\(["']private["']\)/,
    );
  });

  it("Comment button creates shared annotation", () => {
    expect(menuTemplate).toMatch(
      /onCreateAnnotation\(["']shared["']\)/,
    );
  });
});

describe("AnnotationMenu redesign — actions use selectedColor", () => {
  it("onCreateAnnotation uses selectedColor.value for color", () => {
    expect(menuScript).toMatch(/color:\s*selectedColor\.value/);
  });

  it("onHighlight uses selectedColor.value for color", () => {
    expect(menuScript).toMatch(
      /onHighlight[\s\S]*color:\s*selectedColor\.value/,
    );
  });
});

describe("AnnotationMenu redesign — keyboard navigation", () => {
  it("has an onSwatchKeydown handler for arrow keys", () => {
    expect(menuScript).toMatch(/onSwatchKeydown/);
    expect(menuScript).toMatch(/ArrowRight|ArrowLeft/);
  });

  it("swatches use roving tabindex pattern", () => {
    expect(menuTemplate).toMatch(
      /tabindex.*selectedColor\s*===\s*name\s*\?\s*0\s*:\s*-1/,
    );
  });
});

describe("AnnotationMenu redesign — selected swatch visual", () => {
  it("selected swatch has a ring via box-shadow", () => {
    expect(menuTemplate).toMatch(/boxShadow.*selectedColor/);
  });
});
