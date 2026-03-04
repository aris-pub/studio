import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// These tests verify CSS structure in Canvas.vue to prevent regressions
// in scroll container and annotation column layout.

const canvasSource = readFileSync(
  resolve(__dirname, "../../../views/workspace/Canvas.vue"),
  "utf-8",
);

describe("Canvas.vue — scroll container layout (std-gf5h)", () => {
  it("overflow-y: auto is on .inner.right, NOT on .middle-column", () => {
    // .inner.right should have overflow-y: auto
    expect(canvasSource).toMatch(/&\.right\s*\{[^}]*overflow-y:\s*auto/s);

    // .middle-column should NOT have overflow-y
    const middleColumnMatch = canvasSource.match(
      /\.inner\.right\s+\.middle-column\s*\{([^}]*)\}/s,
    );
    if (middleColumnMatch) {
      expect(middleColumnMatch[1]).not.toContain("overflow-y");
    }
  });

  it(".inner.right has scrollbar styling", () => {
    expect(canvasSource).toContain("scrollbar-gutter: stable");
    expect(canvasSource).toContain("scrollbar-width: thin");
  });

  it(".right-column does NOT have position: sticky or overflow-y", () => {
    const rightColMatch = canvasSource.match(
      /\.inner\.right\s+\.right-column\s*\{([^}]*)\}/s,
    );
    expect(rightColMatch).toBeTruthy();
    expect(rightColMatch[1]).not.toContain("position: sticky");
    expect(rightColMatch[1]).not.toContain("overflow-y");
  });

  it(".right-column has fixed width 280px with min/max constraints", () => {
    const rightColMatch = canvasSource.match(
      /\.inner\.right\s+\.right-column\s*\{([^}]*)\}/s,
    );
    expect(rightColMatch).toBeTruthy();
    expect(rightColMatch[1]).toContain("flex: 0 0 280px");
    expect(rightColMatch[1]).toContain("min-width: 250px");
    expect(rightColMatch[1]).toContain("max-width: 300px");
  });

  it(".inner.right has align-items: flex-start", () => {
    expect(canvasSource).toMatch(/&\.right\s*\{[^}]*align-items:\s*flex-start/s);
  });
});

describe("DockableAnnotations container — padding and gap (std-gf5h cont.)", () => {
  const dockableSource = readFileSync(
    resolve(__dirname, "../../../views/workspace/DockableAnnotations.vue"),
    "utf-8",
  );

  it("has padding 16px 12px", () => {
    expect(dockableSource).toContain("padding: 16px 12px");
  });

  it("has flex column layout with 12px gap", () => {
    expect(dockableSource).toContain("flex-direction: column");
    expect(dockableSource).toContain("gap: 12px");
  });
});
