import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const topbarSource = readFileSync(
  resolve(__dirname, "../../../views/workspace/ReaderTopbar.vue"),
  "utf-8"
);
const topbarTemplate = topbarSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
const topbarScript = topbarSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";
const topbarStyle = topbarSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";

const canvasSource = readFileSync(
  resolve(__dirname, "../../../views/workspace/Canvas.vue"),
  "utf-8"
);
const canvasScript = canvasSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";
const canvasStyle = canvasSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";

// std-yj1s: Fix double animation conflict
describe("ReaderTopbar — no internal show/hide transitions (std-yj1s)", () => {
  it("topbar does NOT have opacity transition", () => {
    // The parent Dock controls show/hide — topbar should not have its own
    expect(topbarStyle).not.toMatch(/\.topbar\s*\{[^}]*transition:[^}]*opacity/s);
  });

  it("topbar does NOT have transform transition", () => {
    expect(topbarStyle).not.toMatch(/\.topbar\s*\{[^}]*transition:[^}]*transform/s);
  });

  it("topbar does NOT have will-change for opacity/transform", () => {
    expect(topbarStyle).not.toMatch(/\.topbar\s*\{[^}]*will-change/s);
  });
});

// std-vw2m: Fix height:2px collapsed state
describe("ReaderTopbar — collapsed state is height:0 or opacity-only (std-vw2m)", () => {
  it("Canvas does NOT collapse Dock to height:2px", () => {
    expect(canvasStyle).not.toContain("height: 2px");
  });

  it("Canvas Dock parent does NOT have background !important", () => {
    expect(canvasStyle).not.toMatch(/\.dock\.top\.middle[^}]*background[^}]*!important/s);
  });
});

// std-v84t: Fix immedate typo
describe("ReaderTopbar — no immedate typo in Canvas (std-v84t)", () => {
  it("Canvas does not contain 'immedate'", () => {
    expect(canvasSource).not.toContain("immedate");
  });

  it("Canvas watcher uses immediate: true", () => {
    expect(canvasScript).toMatch(/\{\s*immediate:\s*true\s*\}/);
  });
});

// std-4wzh: Remove z-index:9999
describe("ReaderTopbar — no excessive z-index (std-4wzh)", () => {
  it("topbar does NOT have z-index: 9999", () => {
    expect(topbarStyle).not.toContain("z-index: 9999");
  });

  it("topbar does NOT set any z-index (parent handles stacking)", () => {
    expect(topbarStyle).not.toMatch(/\.topbar\s*\{[^}]*z-index/s);
  });
});

// std-6ue4: Remove min-width + transform hack
describe("ReaderTopbar — no min-width/transform hack on Dock (std-6ue4)", () => {
  it("Canvas Dock parent does NOT use min-width v-bind", () => {
    expect(canvasStyle).not.toMatch(/\.dock\.top\.middle[^}]*min-width/s);
  });

  it("Canvas Dock parent does NOT use transform: translateX", () => {
    expect(canvasStyle).not.toMatch(/\.dock\.top\.middle[^}]*translateX/s);
  });

  it("Canvas script does NOT compute middleTopWidth", () => {
    expect(canvasScript).not.toContain("middleTopWidth");
  });
});

// std-rqdi: Fix width conflict
describe("ReaderTopbar — consistent width strategy (std-rqdi)", () => {
  it("topbar does NOT set max-width: 720px (parent handles width)", () => {
    expect(topbarStyle).not.toMatch(/\.topbar\s*\{[^}]*max-width:\s*720px/s);
  });
});

// std-lnry: Show manuscript title not filename
describe("ReaderTopbar — shows manuscript title (std-lnry)", () => {
  it("does NOT use FileTitle component for scroll title", () => {
    expect(topbarTemplate).not.toMatch(/FileTitle.*showTitle/);
  });

  it("displays manuscript heading text", () => {
    // Should show the extracted H1 text, not the file title
    expect(topbarScript).toMatch(/manuscriptTitle|headingText|titleText/);
  });
});

// std-wxeb: Scroll-direction hysteresis
describe("ReaderTopbar — scroll-direction hysteresis (std-wxeb)", () => {
  it("Canvas tracks scroll direction", () => {
    expect(canvasScript).toMatch(/scrollDirection|lastScrollTop|scrollingDown/);
  });
});

// std-vcrh: Section breadcrumb
describe("ReaderTopbar — section breadcrumb (std-vcrh)", () => {
  it("Canvas computes current section from scroll position", () => {
    expect(canvasScript).toMatch(/currentSection|sectionBreadcrumb|activeSections/);
  });

  it("topbar template shows section info", () => {
    expect(topbarTemplate).toMatch(/breadcrumb|currentSection|sectionLabel/);
  });
});

// std-ag6w: Scroll-to-top button
describe("ReaderTopbar — scroll-to-top button (std-ag6w)", () => {
  it("topbar has a scroll-to-top action", () => {
    expect(topbarTemplate).toMatch(/scroll.*top|scrollToTop/i);
  });
});

// std-v9g6: Fix uppercase title
describe("ReaderTopbar — no uppercase title (std-v9g6)", () => {
  it("title does NOT use text-h6 class", () => {
    expect(topbarTemplate).not.toContain('class="text-h6"');
  });
});

// std-qqy6: Add padding
describe("ReaderTopbar — has padding (std-qqy6)", () => {
  it("topbar has padding-inline", () => {
    expect(topbarStyle).toMatch(/\.topbar\s*\{[^}]*padding-inline/s);
  });
});

// std-jhxy: Fix double-shadow seam
describe("ReaderTopbar — no double shadow (std-jhxy)", () => {
  it("active topbar does NOT use box-shadow", () => {
    expect(topbarStyle).not.toMatch(/\.topbar\.active[^}]*box-shadow/s);
  });

  it("active topbar uses border-bottom for separation", () => {
    expect(topbarStyle).toMatch(/\.topbar\.active[^}]*border-bottom/s);
  });
});
