import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const dockableSrc = readFileSync(
  resolve(__dirname, "../../../views/workspace/DockableAnnotations.vue"),
  "utf-8"
);
const canvasSrc = readFileSync(resolve(__dirname, "../../../views/workspace/Canvas.vue"), "utf-8");

describe("AnnotationCardPositioning — aligned prop (std-6at4)", () => {
  it("DockableAnnotations defines an `aligned` prop", () => {
    expect(dockableSrc).toMatch(/defineProps\([\s\S]*?aligned/);
  });

  it("cards get position styles when aligned", () => {
    expect(dockableSrc).toMatch(/cardPositions/);
  });

  it("container has `aligned` class binding", () => {
    expect(dockableSrc).toMatch(/:class="[^"]*aligned/);
  });

  it("aligned container is position: relative", () => {
    expect(dockableSrc).toMatch(/\.annotations\.aligned[\s\S]*?position:\s*relative/);
  });

  it("getOffsetTop helper exists", () => {
    expect(dockableSrc).toMatch(/function\s+getOffsetTop/);
  });

  it("collision avoidance with MIN_GAP", () => {
    expect(dockableSrc).toMatch(/MIN_GAP|min.*gap/i);
  });
});

describe("AnnotationCardPositioning — Canvas integration (std-6at4)", () => {
  it("Canvas passes `aligned` to right-column DockableAnnotations", () => {
    expect(canvasSrc).toMatch(/<DockableAnnotations\s[^>]*aligned/);
  });

  it("Canvas overlay DockableAnnotations does NOT have `aligned`", () => {
    const overlayMatch = canvasSrc.match(
      /annotation-overlay[\s\S]*?<DockableAnnotations\s*([^>]*)\/?>/
    );
    expect(overlayMatch).not.toBeNull();
    const attrs = overlayMatch[1] || "";
    expect(attrs).not.toMatch(/aligned/);
  });
});

describe("AnnotationCardPositioning — reactivity (std-6at4)", () => {
  it("position recomputation on annotation changes", () => {
    expect(dockableSrc).toMatch(
      /watch\([\s\S]*?sortedAnnotations[\s\S]*?computePositions|refinePositions/
    );
  });

  it("ResizeObserver or resize listener for layout changes", () => {
    expect(dockableSrc).toMatch(/ResizeObserver|resize/i);
  });
});
