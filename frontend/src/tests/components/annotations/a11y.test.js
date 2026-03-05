import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const noteSource = readFileSync(
  resolve(__dirname, "../../../components/annotations/Note.vue"),
  "utf-8"
);
const noteTemplate = noteSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
const noteStyle = noteSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";

const menuSource = readFileSync(
  resolve(__dirname, "../../../components/annotations/AnnotationMenu.vue"),
  "utf-8"
);
const menuTemplate = menuSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
const menuStyle = menuSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";

const canvasSource = readFileSync(
  resolve(__dirname, "../../../views/workspace/Canvas.vue"),
  "utf-8"
);
const canvasTemplate = canvasSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";

describe("Note.vue — focus visibility (std-edzz)", () => {
  it("card has focus-visible outline style", () => {
    expect(noteStyle).toMatch(/\.note:focus-visible/);
  });

  it("focus-visible uses --border-action outline", () => {
    const focusBlock = noteStyle.match(/\.note:focus-visible\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(focusBlock).toContain("outline");
    expect(focusBlock).toContain("var(--border-action)");
  });
});

describe("Note.vue — action buttons visible on focus-within (std-y6s9)", () => {
  it("note:focus-within shows action buttons", () => {
    expect(noteStyle).toMatch(/\.note:focus-within[\s\S]*?\.actions[\s\S]*?opacity:\s*1/);
  });
});

describe("Note.vue — aria-labels on action buttons (std-01at)", () => {
  it("edit button has aria-label", () => {
    expect(noteTemplate).toMatch(/icon="Edit"[\s\S]*?aria-label/);
  });

  it("delete button has aria-label", () => {
    expect(noteTemplate).toMatch(/delete-btn[\s\S]*?aria-label/);
  });

  it("collapse button has aria-label", () => {
    expect(noteTemplate).toMatch(/:icon="collapsed[\s\S]*?aria-label/);
  });
});

describe("Note.vue — textarea focus outline (std-9ywg)", () => {
  it("edit-input focus has outline, not just border-color", () => {
    const focusBlock = noteStyle.match(/\.edit-input:focus\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(focusBlock).toContain("outline");
  });
});

describe("AnnotationMenu.vue — swatch focus-visible (std-ao8d)", () => {
  it("swatch-btn has focus-visible style", () => {
    expect(menuStyle).toMatch(/swatch-btn[\s\S]*?focus-visible/);
  });

  it("swatch-btn focus-visible uses outline", () => {
    const focusBlock = menuStyle.match(/&:focus-visible\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(focusBlock).toContain("outline");
  });
});

describe("AnnotationMenu.vue — textarea focus outline (std-9ywg)", () => {
  it("note-input focus has outline", () => {
    const focusBlock = menuStyle.match(/note-input[\s\S]*?&:focus\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(focusBlock).toContain("outline");
  });
});

describe("AnnotationMenu.vue — menu container role (std-zbdz)", () => {
  it("hl-menu has role attribute", () => {
    expect(menuTemplate).toMatch(/class="hl-menu"[\s\S]*?role=/);
  });

  it("hl-menu has aria-label", () => {
    expect(menuTemplate).toMatch(/class="hl-menu"[\s\S]*?aria-label=/);
  });
});

describe("Canvas.vue — overlay panel role (std-aa3y)", () => {
  it("annotation-overlay has role attribute", () => {
    expect(canvasTemplate).toMatch(/class="annotation-overlay"[\s\S]*?role=/);
  });

  it("annotation-overlay has aria-label", () => {
    expect(canvasTemplate).toMatch(/class="annotation-overlay"[\s\S]*?aria-label=/);
  });
});
