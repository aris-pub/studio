import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// These tests verify CSS structure in Canvas.vue to prevent regressions
// in scroll container and annotation column layout.

const canvasSource = readFileSync(
  resolve(__dirname, "../../../views/workspace/Canvas.vue"),
  "utf-8"
);

describe("Canvas.vue — scroll container layout (std-gf5h)", () => {
  it("overflow-y: auto is on .inner.right, NOT on .middle-column", () => {
    // .inner.right should have overflow-y: auto
    expect(canvasSource).toMatch(/&\.right\s*\{[^}]*overflow-y:\s*auto/s);

    // .middle-column should NOT have overflow-y
    const middleColumnMatch = canvasSource.match(/\.inner\.right\s+\.middle-column\s*\{([^}]*)\}/s);
    if (middleColumnMatch) {
      expect(middleColumnMatch[1]).not.toContain("overflow-y");
    }
  });

  it(".inner.right has scrollbar styling", () => {
    expect(canvasSource).toContain("scrollbar-gutter: stable");
    expect(canvasSource).toContain("scrollbar-width: thin");
  });

  it(".right-column does NOT have position: sticky or overflow-y", () => {
    const rightColMatch = canvasSource.match(/\.inner\.right\s+\.right-column\s*\{([^}]*)\}/s);
    expect(rightColMatch).toBeTruthy();
    expect(rightColMatch[1]).not.toContain("position: sticky");
    expect(rightColMatch[1]).not.toContain("overflow-y");
  });

  it(".right-column is absolutely positioned at manuscript edge", () => {
    const rightColMatch = canvasSource.match(/\.inner\.right\s+\.right-column\s*\{([^}]*)\}/s);
    expect(rightColMatch).toBeTruthy();
    expect(rightColMatch[1]).toContain("position: absolute");
    expect(rightColMatch[1]).toContain("left: 100%");
    expect(rightColMatch[1]).toContain("width: 280px");
  });

  it(".inner.right has align-items: flex-start", () => {
    expect(canvasSource).toMatch(/&\.right\s*\{[^}]*align-items:\s*flex-start/s);
  });

  it("annotation cards have max-width constraint to prevent overflow in split view", () => {
    const rightColMatch = canvasSource.match(/\.inner\.right\s+\.right-column\s*\{([^}]*)\}/s);
    expect(rightColMatch).toBeTruthy();
    expect(rightColMatch[1]).toContain("max-width:");
    expect(rightColMatch[1]).toContain("overflow: hidden");
  });
});

describe("Canvas.vue — manuscript centering and annotation layout", () => {
  it("manuscript is centered by default (margin: 0 auto on .dock.main)", () => {
    const dockMainMatch = canvasSource.match(/\.inner\.right\s+\.dock\.main\s*\{([^}]*)\}/s);
    expect(dockMainMatch).toBeTruthy();
    expect(dockMainMatch[1]).toContain("margin: 0 auto");
  });

  it("manuscript left-aligns when editor open AND annotations present", () => {
    expect(canvasSource).toMatch(
      /\.inner\.left\s*\+\s*\.inner\.right\s+\.dock\.main:has\(\.right-column\)\s*\{[^}]*margin:\s*0[^}]*\}/s
    );
  });

  it("editor gets wider max-width when no annotations present", () => {
    expect(canvasSource).toMatch(
      /\.inner\.left:has\(\+\s*\.inner\.right:not\(:has\(\.right-column\)\)\)\s*\{[^}]*max-width:\s*640px/s
    );
  });

  it(".middle-column is always flex: 1 (not conditional on annotations)", () => {
    const middleColMatch = canvasSource.match(/\.inner\.right\s+\.middle-column\s*\{([^}]*)\}/s);
    expect(middleColMatch).toBeTruthy();
    expect(middleColMatch[1]).toContain("flex: 1");
    // Should NOT have a .no-annotations conditional
    expect(canvasSource).not.toContain("no-annotations");
  });

  it(".right-column is inside .dock.main.middle (not a sibling column)", () => {
    // The v-if for right-column must be inside a Dock with class "dock middle main"
    // Verify by checking the template nesting: right-column-ref appears after ManuscriptWrapper
    // and before the closing Dock tag
    const templateSection = canvasSource.match(/<template>([\s\S]*)<\/template>/);
    expect(templateSection).toBeTruthy();
    // right-column should appear after manuscript-ref and inside the middle main dock
    const manuscriptIdx = templateSection[1].indexOf('ref="manuscript-ref"');
    const rightColIdx = templateSection[1].indexOf('ref="right-column-ref"');
    expect(manuscriptIdx).toBeGreaterThan(-1);
    expect(rightColIdx).toBeGreaterThan(-1);
    expect(rightColIdx).toBeGreaterThan(manuscriptIdx);
    // And the right-column should NOT be a direct child of .inner.right in the template
    // (it should be nested deeper, inside the dock)
    const rightColLine = templateSection[1].substring(rightColIdx - 200, rightColIdx);
    expect(rightColLine).not.toMatch(/class="inner right"[^]*ref="right-column-ref"/);
  });
});

describe("DockableAnnotations container — padding and gap (std-gf5h cont.)", () => {
  const dockableSource = readFileSync(
    resolve(__dirname, "../../../views/workspace/DockableAnnotations.vue"),
    "utf-8"
  );

  it("has padding 16px 12px", () => {
    expect(dockableSource).toContain("padding: 16px 12px");
  });

  it("has flex column layout with 12px gap", () => {
    expect(dockableSource).toContain("flex-direction: column");
    expect(dockableSource).toContain("gap: 12px");
  });
});
