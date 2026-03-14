import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const cssPath = resolve(__dirname, "../../../../site/assets/css/rsm-design-system.css");
const css = readFileSync(cssPath, "utf-8");

describe("design tokens: border-radius scale", () => {
  const expectedTokens = ["--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"];

  it.each(expectedTokens)("defines %s", (token) => {
    expect(css).toContain(`${token}:`);
  });

  it("defines --border-radius as alias to --radius-sm", () => {
    expect(css).toMatch(/--border-radius:\s*var\(--radius-sm\)/);
  });
});
