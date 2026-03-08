import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { useSearch } from "@/composables/useSearch.js";
import * as HSM from "@/utils/highlightSearchMatches.js";

describe("useSearch scopes", () => {
  const makeMark = () => ({
    scrollIntoView: vi.fn(),
    classList: { remove: vi.fn(), add: vi.fn() },
  });

  let manuscriptEl;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);
    vi.spyOn(HSM, "highlightMathMatches").mockReturnValue([]);
    vi.spyOn(HSM, "clearHighlights").mockImplementation(() => {});
    vi.spyOn(HSM, "updateCurrentMatch").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createSearch = (overrides = {}) => {
    const manuscriptRef = overrides.manuscriptRef ?? ref({ $el: manuscriptEl });
    const file = overrides.file ?? ref({ source: "test content" });
    return useSearch({ manuscriptRef, file });
  };

  describe("activeScopes", () => {
    it("defaults to output scope only", () => {
      const search = createSearch();
      expect(search.activeScopes.value).toEqual(new Set(["output"]));
    });

    it("can toggle scopes on and off", () => {
      const search = createSearch();

      search.toggleScope("source");
      expect(search.activeScopes.value.has("source")).toBe(true);
      expect(search.activeScopes.value.has("output")).toBe(true);

      search.toggleScope("output");
      expect(search.activeScopes.value.has("output")).toBe(false);
      expect(search.activeScopes.value.has("source")).toBe(true);
    });

    it("reverts to output if all scopes toggled off", () => {
      const search = createSearch();
      search.toggleScope("output");
      expect(search.activeScopes.value.has("output")).toBe(true);
    });

    it("supports all three scopes", () => {
      const search = createSearch();
      search.toggleScope("source");
      search.toggleScope("marginalia");

      expect(search.activeScopes.value).toEqual(new Set(["output", "source", "marginalia"]));
    });
  });

  describe("advanced mode", () => {
    it("starts in basic mode", () => {
      const search = createSearch();
      expect(search.isAdvanced.value).toBe(false);
    });

    it("toggles advanced mode", () => {
      const search = createSearch();
      search.toggleAdvanced();
      expect(search.isAdvanced.value).toBe(true);
      search.toggleAdvanced();
      expect(search.isAdvanced.value).toBe(false);
    });
  });

  describe("scope-aware search", () => {
    it("only searches output scope by default", () => {
      const stubMatches = [{ mark: makeMark() }];
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(stubMatches);

      const search = createSearch();
      search.search("test");

      expect(HSM.highlightSearchMatches).toHaveBeenCalled();
      expect(search.matches.value).toStrictEqual(stubMatches);
    });

    it("tracks source match count when source scope is active (no CM view)", () => {
      const search = createSearch();
      search.toggleScope("source");
      search.search("test");

      // Without a CM view, source match count stays 0
      expect(search.sourceMatchCount.value).toBe(0);
    });
  });
});
