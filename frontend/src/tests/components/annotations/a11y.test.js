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
const canvasScript = canvasSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";

const dockableSource = readFileSync(
  resolve(__dirname, "../../../views/workspace/DockableAnnotations.vue"),
  "utf-8"
);
const dockableTemplate = dockableSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";

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

describe("AnnotationMenu.vue — swatch border contrast (std-sdg2)", () => {
  it("swatch-circle border uses gray-800 for WCAG 3:1 against all swatch colors", () => {
    expect(menuStyle).toMatch(/\.swatch-circle[\s\S]*?border:[\s\S]*?var\(--gray-800\)/);
  });
});

describe("AnnotationMenu.vue — button focus outline (std-9ywg)", () => {
  it("swatch-btn focus-visible has outline", () => {
    const focusBlock = menuStyle.match(/\.swatch-btn[\s\S]*?&:focus-visible\s*\{([^}]*)\}/s)?.[1] ?? "";
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

describe("Canvas.vue — overlay focus management (std-czeu)", () => {
  it("overlay panel has tabindex for programmatic focus", () => {
    expect(canvasTemplate).toMatch(/class="annotation-overlay"[\s\S]*?tabindex="-1"/);
  });

  it("focus moves into overlay on open", () => {
    expect(canvasScript).toMatch(/overlayPanelRef[\s\S]*?\.focus\(\)/);
  });

  it("focus returns to toggle on close", () => {
    expect(canvasScript).toMatch(/overlayToggleRef[\s\S]*?\.focus\(\)/);
  });
});

describe("Canvas.vue — toggle aria-label reflects state (std-zhy4)", () => {
  it("aria-label switches between Show/Hide", () => {
    expect(canvasTemplate).toMatch(/annotationOverlayOpen\s*\?\s*'Hide annotations'/);
  });
});

describe("DockableAnnotations.vue — container semantics (std-yyo8)", () => {
  it("annotations container has role=region", () => {
    expect(dockableTemplate).toMatch(/role="region"/);
  });

  it("annotations container has aria-label", () => {
    expect(dockableTemplate).toMatch(/aria-label="Annotations list"/);
  });
});

describe("Note.vue — visually-hidden textarea label (std-wz20)", () => {
  it("edit textarea has a label element", () => {
    expect(noteTemplate).toMatch(/<label[\s\S]*?class="sr-only"[\s\S]*?Annotation note/);
  });

  it("label for attribute matches textarea id", () => {
    expect(noteTemplate).toMatch(/:for="`note-edit-\$\{annotation\.id\}`"/);
    expect(noteTemplate).toMatch(/:id="`note-edit-\$\{annotation\.id\}`"/);
  });
});

describe("AnnotationMenu.vue — action buttons have visible text labels (std-wz20)", () => {
  it("Note button has visible text label", () => {
    expect(menuTemplate).toMatch(/text="Note"/);
  });

  it("Comment button has visible text label", () => {
    expect(menuTemplate).toMatch(/text="Comment"/);
  });

  it("Highlight button has visible text label", () => {
    expect(menuTemplate).toMatch(/text="Highlight"/);
  });
});

describe("AnnotationMenu.vue — separator aria-hidden (std-d0be)", () => {
  it("separator has aria-hidden=true", () => {
    expect(menuTemplate).toMatch(/class="separator"[\s\S]*?aria-hidden="true"/);
  });
});

describe("Note.vue — WCAG AA contrast for card hierarchy (std-nn1a)", () => {
  it("timestamp uses gray-800 (not gray-500)", () => {
    expect(noteStyle).toMatch(/\.timestamp[\s\S]*?color:\s*var\(--gray-800\)/);
  });

  it("timestamp is 10px with 0.06em tracking", () => {
    expect(noteStyle).toMatch(/\.timestamp[\s\S]*?font-size:\s*10px/);
    expect(noteStyle).toMatch(/\.timestamp[\s\S]*?letter-spacing:\s*0\.06em/);
  });

  it("action icons inherit color from Button component variants (except resolve)", () => {
    const withoutResolve = noteStyle.replace(/\.resolve-btn[\s\S]*?}/g, "");
    expect(withoutResolve).not.toMatch(/\.actions[\s\S]*?\.tabler-icon[\s\S]*?color:/);
  });

  it("delete icon uses gray-700", () => {
    expect(noteStyle).toMatch(/\.delete-icon[\s\S]*?color:\s*var\(--gray-700\)/);
  });

  it("selected-text uses gray-800 (not gray-700)", () => {
    expect(noteStyle).toMatch(/\.selected-text[\s\S]*?color:\s*var\(--gray-800\)/);
  });
});

describe("Canvas.vue — j/k/h/l skips text inputs (regression)", () => {
  it("keyboard handler checks activeElement tag before capturing j/k/h/l", () => {
    expect(canvasScript).toMatch(/activeElement[\s\S]*?TEXTAREA/);
    expect(canvasScript).toMatch(/activeElement[\s\S]*?INPUT/);
  });

  it("keyboard handler checks contentEditable", () => {
    expect(canvasScript).toMatch(/isContentEditable/);
  });
});
