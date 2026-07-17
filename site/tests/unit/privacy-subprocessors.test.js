/**
 * Guards the GDPR sub-processor disclosure on the privacy policy: every
 * third-party service that processes user data must be listed, so the section
 * can't be silently dropped. Content-level check (Nuxt pages aren't mounted in
 * these unit tests), which is enough to catch a regression here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

// Vitest runs with the site package dir as cwd (see package.json "test").
const privacy = readFileSync(resolve(process.cwd(), "pages/privacy.vue"), "utf8");

describe("privacy policy sub-processors", () => {
  it("discloses every sub-processor that handles user data", () => {
    for (const provider of ["Supabase", "Fly.io", "Netlify", "Resend", "Sentry"]) {
      expect(privacy).toContain(provider);
    }
  });

  it("states the sub-processors operate under a data processing agreement", () => {
    expect(privacy).toContain("data processing agreement");
  });
});
