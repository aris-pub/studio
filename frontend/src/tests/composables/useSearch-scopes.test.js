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
    vi.spyOn(HSM, "highlightSearchMatchesSource").mockReturnValue([]);
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
    it("defaults to document scope only", () => {
      const search = createSearch();
      expect(search.activeScopes.value).toEqual(new Set(["document"]));
    });

    it("can toggle scopes on and off", () => {
      const search = createSearch();

      search.toggleScope("source");
      expect(search.activeScopes.value.has("source")).toBe(true);
      expect(search.activeScopes.value.has("document")).toBe(true);

      search.toggleScope("document");
      expect(search.activeScopes.value.has("document")).toBe(false);
      expect(search.activeScopes.value.has("source")).toBe(true);
    });

    it("reverts to document if all scopes toggled off", () => {
      const search = createSearch();
      search.toggleScope("document");
      // Should auto-revert since no scopes remain
      expect(search.activeScopes.value.has("document")).toBe(true);
    });

    it("supports all four scopes", () => {
      const search = createSearch();
      search.toggleScope("source");
      search.toggleScope("marginalia");
      search.toggleScope("math");

      expect(search.activeScopes.value).toEqual(
        new Set(["document", "source", "marginalia", "math"])
      );
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
    it("only searches document scope by default", () => {
      const stubMatches = [{ mark: makeMark() }];
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(stubMatches);

      const search = createSearch();
      search.search("test");

      expect(HSM.highlightSearchMatches).toHaveBeenCalled();
      expect(search.matches.value).toStrictEqual(stubMatches);
    });

    it("searches source when source scope is active", () => {
      const sourceMatches = [{ index: 0, text: "test", line: 1, column: 1 }];
      vi.spyOn(HSM, "highlightSearchMatchesSource").mockReturnValue(sourceMatches);

      const search = createSearch();
      search.toggleScope("source");
      search.search("test");

      expect(HSM.highlightSearchMatchesSource).toHaveBeenCalled();
      expect(search.sourceMatches.value).toStrictEqual(sourceMatches);
    });
  });
});
