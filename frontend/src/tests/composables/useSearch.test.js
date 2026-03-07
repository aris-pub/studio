import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import { useSearch } from "@/composables/useSearch.js";
import * as HSM from "@/utils/highlightSearchMatches.js";

describe("useSearch composable", () => {
  const makeMark = () => ({
    scrollIntoView: vi.fn(),
    classList: { remove: vi.fn(), add: vi.fn() },
  });

  const stubMatches = [{ mark: makeMark() }, { mark: makeMark() }];

  let manuscriptEl;

  beforeEach(() => {
    manuscriptEl = document.createElement("div");
    vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(stubMatches);
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

  describe("search lifecycle", () => {
    it("starts with empty state", () => {
      const search = createSearch();
      expect(search.query.value).toBe("");
      expect(search.isSearching.value).toBe(false);
      expect(search.matches.value).toEqual([]);
      expect(search.currentIndex.value).toBe(-1);
    });

    it("executes search and populates matches", () => {
      const search = createSearch();
      search.search("hello");

      expect(search.isSearching.value).toBe(true);
      expect(search.query.value).toBe("hello");
      expect(HSM.highlightSearchMatches).toHaveBeenCalledWith(manuscriptEl, "hello", {});
      expect(search.matches.value).toStrictEqual(stubMatches);
      expect(search.currentIndex.value).toBe(0);
    });

    it("trims whitespace from query", () => {
      const search = createSearch();
      search.search("  hello  ");

      expect(search.query.value).toBe("hello");
      expect(HSM.highlightSearchMatches).toHaveBeenCalledWith(manuscriptEl, "hello", {});
    });

    it("ignores empty or whitespace-only queries", () => {
      const search = createSearch();
      search.search("");
      expect(search.isSearching.value).toBe(false);
      expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();

      search.search("   ");
      expect(search.isSearching.value).toBe(false);
      expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
    });

    it("clears previous highlights before new search", () => {
      const search = createSearch();
      search.search("first");
      search.search("second");

      expect(HSM.clearHighlights).toHaveBeenCalledWith(manuscriptEl);
    });

    it("does not search when manuscriptRef is null", () => {
      const search = createSearch({ manuscriptRef: ref(null) });
      search.search("hello");

      expect(search.isSearching.value).toBe(false);
      expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
    });
  });

  describe("navigation", () => {
    it("next() advances to the next match", () => {
      const search = createSearch();
      search.search("test");
      expect(search.currentIndex.value).toBe(0);

      search.next();
      expect(search.currentIndex.value).toBe(1);
      expect(stubMatches[1].mark.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      });
      expect(HSM.updateCurrentMatch).toHaveBeenCalledWith(stubMatches, 1);
    });

    it("next() wraps around to first match", () => {
      const search = createSearch();
      search.search("test");
      search.next(); // index 1
      search.next(); // wraps to 0

      expect(search.currentIndex.value).toBe(0);
      expect(stubMatches[0].mark.scrollIntoView).toHaveBeenCalled();
    });

    it("prev() goes to the previous match", () => {
      const search = createSearch();
      search.search("test");
      search.next(); // index 1
      search.prev(); // back to 0

      expect(search.currentIndex.value).toBe(0);
    });

    it("prev() wraps around to last match", () => {
      const search = createSearch();
      search.search("test");
      // currentIndex starts at 0
      search.prev(); // wraps to 1

      expect(search.currentIndex.value).toBe(1);
    });

    it("next() and prev() are no-ops when not searching", () => {
      const search = createSearch();
      search.next();
      search.prev();
      expect(search.currentIndex.value).toBe(-1);
    });

    it("next() and prev() are no-ops with zero matches", () => {
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);
      const search = createSearch();
      search.search("nomatch");
      search.next();
      search.prev();
      expect(search.currentIndex.value).toBe(-1);
    });

    it("next() calls updateCurrentMatch even when target match has null mark", () => {
      const matchesWithNullMark = [
        { mark: makeMark() },
        { mark: null },
        { mark: makeMark() },
      ];
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(matchesWithNullMark);
      HSM.updateCurrentMatch.mockClear();

      const search = createSearch();
      search.search("test");
      HSM.updateCurrentMatch.mockClear();

      search.next(); // index 0 → 1 (null mark)
      expect(search.currentIndex.value).toBe(1);
      expect(HSM.updateCurrentMatch).toHaveBeenCalledWith(matchesWithNullMark, 1);
    });

    it("prev() calls updateCurrentMatch even when target match has null mark", () => {
      const matchesWithNullMark = [
        { mark: null },
        { mark: makeMark() },
      ];
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(matchesWithNullMark);

      const search = createSearch();
      search.search("test");
      // currentIndex starts at 0 (null mark)
      HSM.updateCurrentMatch.mockClear();

      search.prev(); // wraps to index 1
      expect(HSM.updateCurrentMatch).toHaveBeenCalledWith(matchesWithNullMark, 1);

      HSM.updateCurrentMatch.mockClear();
      search.prev(); // wraps back to index 0 (null mark)
      expect(search.currentIndex.value).toBe(0);
      expect(HSM.updateCurrentMatch).toHaveBeenCalledWith(matchesWithNullMark, 0);
    });

    it("does not call scrollIntoView when match.mark is null", () => {
      const goodMark = makeMark();
      const matchesWithNullMark = [
        { mark: goodMark },
        { mark: null },
      ];
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(matchesWithNullMark);

      const search = createSearch();
      search.search("test");
      goodMark.scrollIntoView.mockClear();

      search.next(); // navigate to null mark
      expect(goodMark.scrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe("clear and cancel", () => {
    it("clear() removes highlights and resets state", () => {
      const search = createSearch();
      search.search("test");
      search.clear();

      expect(HSM.clearHighlights).toHaveBeenCalledWith(manuscriptEl);
      expect(search.isSearching.value).toBe(false);
      expect(search.query.value).toBe("");
      expect(search.matches.value).toEqual([]);
      expect(search.currentIndex.value).toBe(-1);
    });

    it("clear() is safe when not searching", () => {
      const search = createSearch();
      expect(() => search.clear()).not.toThrow();
    });
  });

  describe("hintText", () => {
    it("returns empty string when not searching", () => {
      const search = createSearch();
      expect(search.hintText.value).toBe("");
    });

    it("returns 'No matches' when search finds nothing", () => {
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);
      const search = createSearch();
      search.search("nothing");
      expect(search.hintText.value).toBe("No matches");
    });

    it("returns '1 of N' format with matches", () => {
      const search = createSearch();
      search.search("test");
      expect(search.hintText.value).toBe("1 of 2");

      search.next();
      expect(search.hintText.value).toBe("2 of 2");
    });
  });

  describe("search options", () => {
    it("passes caseSensitive option to highlightSearchMatches", () => {
      const search = createSearch();
      search.caseSensitive.value = true;
      search.search("Test");

      expect(HSM.highlightSearchMatches).toHaveBeenCalledWith(manuscriptEl, "Test", {
        caseSensitive: true,
      });
    });

    it("passes wholeWord option to highlightSearchMatches", () => {
      const search = createSearch();
      search.wholeWord.value = true;
      search.search("test");

      expect(HSM.highlightSearchMatches).toHaveBeenCalledWith(manuscriptEl, "test", {
        wholeWord: true,
      });
    });

    it("passes both options together", () => {
      const search = createSearch();
      search.caseSensitive.value = true;
      search.wholeWord.value = true;
      search.search("Test");

      expect(HSM.highlightSearchMatches).toHaveBeenCalledWith(manuscriptEl, "Test", {
        caseSensitive: true,
        wholeWord: true,
      });
    });
  });

  describe("source search", () => {
    it("searches source text in parallel", () => {
      const file = ref({ source: "hello world" });
      const search = createSearch({ file });
      search.search("hello");

      expect(HSM.highlightSearchMatchesSource).toHaveBeenCalledWith("hello world", "hello");
    });

    it("stores source matches separately", () => {
      const sourceMatches = [{ index: 0, text: "hello", line: 1, column: 1 }];
      vi.spyOn(HSM, "highlightSearchMatchesSource").mockReturnValue(sourceMatches);

      const search = createSearch();
      search.search("hello");

      expect(search.sourceMatches.value).toStrictEqual(sourceMatches);
    });
  });
});
