import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const noteSource = readFileSync(
  resolve(__dirname, "../../../components/annotations/Note.vue"),
  "utf-8"
);
const noteScript = noteSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";

// std-wm74: Scroll active annotation card into view
describe("Note.vue — scroll active card into view (std-wm74)", () => {
  it("watches isActive and calls scrollIntoView", () => {
    expect(noteScript).toMatch(/watch\(\s*isActive/);
  });

  it("uses scrollIntoView with smooth behavior", () => {
    expect(noteScript).toMatch(/scrollIntoView\(\s*\{[^}]*behavior:\s*["']smooth["']/);
  });

  it("only scrolls when becoming active (not on deactivation)", () => {
    expect(noteScript).toMatch(/watch\(\s*isActive\s*,\s*\(\s*\w+\s*\)\s*=>\s*\{?\s*if\s*\(\w+\)/);
  });
});
