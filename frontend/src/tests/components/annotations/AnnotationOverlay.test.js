import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const canvasSource = readFileSync(
  resolve(__dirname, "../../../views/workspace/Canvas.vue"),
  "utf-8"
);

const templateSection = canvasSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
const styleSection = canvasSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";
const scriptSection = canvasSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";

describe("Canvas.vue — annotation overlay toggle button (std-y6e3)", () => {
  it("toggle button exists with annotation-overlay-toggle class", () => {
    expect(templateSection).toContain("annotation-overlay-toggle");
  });

  it("toggle is conditional on hasAnnotations, !mobileMode, !showAnnotationCards", () => {
    const toggleVif =
      templateSection.match(
        /v-if="([^"]*!showAnnotationCards[^"]*)"[\s\S]{0,300}annotation-overlay-toggle/
      )?.[1] ?? "";
    expect(toggleVif).toContain("hasAnnotations");
    expect(toggleVif).toContain("!showAnnotationCards");
    expect(toggleVif).toContain("!mobileMode");
  });

  it("toggle shows annotation count", () => {
    expect(templateSection).toContain("annotationCount");
  });

  it("toggle has aria-label", () => {
    expect(templateSection).toMatch(/annotation-overlay-toggle[\s\S]*?aria-label/);
  });
});

describe("Canvas.vue — annotation overlay panel (std-y6e3)", () => {
  it("overlay div exists with annotation-overlay class", () => {
    expect(styleSection).toContain(".annotation-overlay");
  });

  it("overlay is conditional on annotationOverlayOpen and !showAnnotationCards", () => {
    const overlayVif =
      templateSection.match(/class="annotation-overlay"[\s\S]{0,300}v-if="([^"]+)"/)?.[1] ??
      templateSection.match(/v-if="([^"]+)"[\s\S]{0,300}class="annotation-overlay"/)?.[1] ??
      "";
    expect(overlayVif).toContain("annotationOverlayOpen");
    expect(overlayVif).toContain("!showAnnotationCards");
  });

  it("overlay contains DockableAnnotations", () => {
    const overlayBlock =
      templateSection.match(/class="annotation-overlay"[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(overlayBlock).toContain("DockableAnnotations");
  });

  it("overlay has position: fixed", () => {
    const overlayCSS = styleSection.match(/\.annotation-overlay\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(overlayCSS).toContain("position: fixed");
  });

  it("overlay z-index is 999", () => {
    const overlayCSS = styleSection.match(/\.annotation-overlay\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(overlayCSS).toContain("z-index: 999");
  });

  it("overlay width is 280px", () => {
    const overlayCSS = styleSection.match(/\.annotation-overlay\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(overlayCSS).toContain("width: 280px");
  });
});

describe("Canvas.vue — overlay toggle positioning and transitions (std-y6e3)", () => {
  const toggleCSS = styleSection.match(/\.annotation-overlay-toggle\s*\{([^}]*)\}/s)?.[1] ?? "";

  it("toggle is absolutely positioned (always visible while scrolling)", () => {
    expect(toggleCSS).toContain("position: absolute");
  });

  it("toggle has minimum 32px height for accessibility", () => {
    expect(toggleCSS).toContain("height: 32px");
  });

  it("toggle has focus-visible outline", () => {
    expect(styleSection).toMatch(/\.annotation-overlay-toggle:focus-visible/);
    expect(styleSection).toMatch(/outline.*var\(--border-action\)/);
  });

  it("toggle has tooltip", () => {
    expect(templateSection).toContain('ref="overlay-toggle-ref"');
    expect(templateSection).toMatch(/Tooltip.*overlayToggleRef/s);
  });

  it("Vue Transition wraps overlay with overlay-slide name", () => {
    expect(templateSection).toContain('<Transition name="overlay-slide"');
  });

  it("slide transition CSS exists with translateX", () => {
    expect(styleSection).toContain(".overlay-slide-enter-from");
    expect(styleSection).toContain("translateX(100%)");
  });
});

describe("Canvas.vue — overlay auto-close watcher (std-y6e3)", () => {
  it("script contains watcher that closes overlay when showAnnotationCards becomes true", () => {
    expect(scriptSection).toContain("annotationOverlayOpen");
    expect(scriptSection).toMatch(/watch\b[\s\S]*?showAnnotationCards/);
  });

  it("clicking a highlight opens overlay when cards are not visible", () => {
    expect(scriptSection).toMatch(
      /watch\(activeAnnotationId[\s\S]*?!showAnnotationCards\.value[\s\S]*?annotationOverlayOpen\.value\s*=\s*true/
    );
  });
});

describe("Canvas.vue — overlay panel uses established UI components (std-y6e3)", () => {
  const overlayBlock =
    templateSection.match(/class="annotation-overlay"[\s\S]*?<\/Transition>/)?.[0] ?? "";

  it("overlay uses Pane component", () => {
    expect(overlayBlock).toContain("<Pane");
  });

  it("overlay has grouped header title with icon", () => {
    expect(overlayBlock).toContain("overlay-header-title");
  });

  it("Pane is closable for dismissal", () => {
    expect(overlayBlock).toMatch(/:closable="true"/);
    expect(overlayBlock).toMatch(/@close="/);
  });

  it("overlay header shows 'Marginalia' title", () => {
    expect(overlayBlock).toMatch(/<h3>Marginalia<\/h3>/);
  });

  it("overlay has border-radius matching drawer pattern", () => {
    const overlayCSS = styleSection.match(/\.annotation-overlay\s*\{([^}]*)\}/s)?.[1] ?? "";
    expect(overlayCSS).toContain("border-radius: 16px");
  });

  it("overlay reduces annotation card padding", () => {
    expect(styleSection).toMatch(/\.annotation-overlay[\s\S]*?:deep\(\.annotations\)/);
  });
});
