import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, shallowRef, nextTick } from "vue";
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
      const matchesWithNullMark = [{ mark: makeMark() }, { mark: null }, { mark: makeMark() }];
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
      const matchesWithNullMark = [{ mark: null }, { mark: makeMark() }];
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
      const matchesWithNullMark = [{ mark: goodMark }, { mark: null }];
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

  describe("scope toggling and output search", () => {
    it("defaults to output scope", () => {
      const search = createSearch();
      expect(search.activeScopes.value.has("output")).toBe(true);
      expect(search.activeScopes.value.size).toBe(1);
    });

    it("toggleScope adds and removes scopes", () => {
      const search = createSearch();
      search.toggleScope("source");
      expect(search.activeScopes.value.has("source")).toBe(true);

      search.toggleScope("source");
      expect(search.activeScopes.value.has("source")).toBe(false);
    });

    it("toggleScope prevents empty scopes — reverts to output", () => {
      const search = createSearch();
      search.toggleScope("output");
      expect(search.activeScopes.value.has("output")).toBe(true);
    });

    it("toggleScope auto-re-searches when active", () => {
      const search = createSearch();
      search.search("test");
      expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(1);

      search.toggleScope("source");
      expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(2);
    });

    it("toggleScope does not re-search when not actively searching", () => {
      const search = createSearch();
      search.toggleScope("source");
      expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
    });

    it("output scope calls both highlightSearchMatches and highlightMathMatches", () => {
      vi.spyOn(HSM, "highlightMathMatches").mockReturnValue([]);
      const search = createSearch();
      search.search("x");

      expect(HSM.highlightSearchMatches).toHaveBeenCalledWith(manuscriptEl, "x", {});
      expect(HSM.highlightMathMatches).toHaveBeenCalledWith(manuscriptEl, "x", {});
    });

    it("non-output scope does not call highlight functions", () => {
      vi.spyOn(HSM, "highlightMathMatches").mockReturnValue([]);
      const search = createSearch();
      search.toggleScope("source");
      search.toggleScope("output");
      search.search("x");

      expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
      expect(HSM.highlightMathMatches).not.toHaveBeenCalled();
    });

    it("merges text and math matches into a single list under output scope", () => {
      const docMatches = [{ mark: makeMark() }];
      const mathMark = makeMark();
      const mathMatches = [{ mark: mathMark, mathEls: [mathMark] }];
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(docMatches);
      vi.spyOn(HSM, "highlightMathMatches").mockReturnValue(mathMatches);

      const search = createSearch();
      search.search("a");

      expect(search.matches.value).toHaveLength(2);
      expect(search.matches.value[0]).toBe(docMatches[0]);
      expect(search.matches.value[1]).toBe(mathMatches[0]);
    });

    it("navigates across mixed text and math matches", () => {
      const docMark = makeMark();
      const mathMark = makeMark();
      const docMatches = [{ mark: docMark }];
      const mathMatches = [{ mark: mathMark, mathEls: [mathMark] }];
      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(docMatches);
      vi.spyOn(HSM, "highlightMathMatches").mockReturnValue(mathMatches);

      const search = createSearch();
      search.search("a");

      expect(search.currentIndex.value).toBe(0);
      search.next();
      expect(search.currentIndex.value).toBe(1);
      expect(mathMark.scrollIntoView).toHaveBeenCalled();
      search.next();
      expect(search.currentIndex.value).toBe(0);
      expect(docMark.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe("re-search on manuscript change", () => {
    it("re-runs search when file.html changes during active search", async () => {
      const file = ref({ source: "test", html: "<p>hello</p>" });
      const search = createSearch({ file });
      search.search("hello");
      expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(1);

      // Simulate recompilation
      file.value = { ...file.value, html: "<p>hello world</p>" };
      await nextTick();
      await nextTick();

      expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(2);
    });

    it("does not re-search when file.html changes but not actively searching", async () => {
      const file = ref({ source: "test", html: "<p>hello</p>" });
      const search = createSearch({ file });

      file.value = { ...file.value, html: "<p>hello world</p>" };
      await nextTick();
      await nextTick();

      expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
    });

    it("preserves query when re-searching after compile", async () => {
      const file = ref({ source: "test", html: "<p>hello</p>" });
      const search = createSearch({ file });
      search.search("hello");

      file.value = { ...file.value, html: "<p>hello updated</p>" };
      await nextTick();
      await nextTick();

      expect(HSM.highlightSearchMatches).toHaveBeenLastCalledWith(manuscriptEl, "hello", {});
    });
  });

  describe("source search (CM integration)", () => {
    it("sourceMatchCount is 0 when source scope is inactive", () => {
      const search = createSearch();
      search.search("hello");
      expect(search.sourceMatchCount.value).toBe(0);
    });

    it("sourceMatchCount is 0 when no cmView is provided", () => {
      const search = createSearch();
      search.toggleScope("source");
      search.search("hello");
      expect(search.sourceMatchCount.value).toBe(0);
    });

    it("dispatches search query to CM and counts matches", async () => {
      const { EditorState } = await import("@codemirror/state");
      const { EditorView } = await import("@codemirror/view");
      const { search: cmSearchExt } = await import("@codemirror/search");

      const state = EditorState.create({
        doc: "hello world hello there hello",
        extensions: [cmSearchExt()],
      });
      const view = new EditorView({ state });
      const cmView = shallowRef(view);

      const s = useSearch({
        manuscriptRef: ref({ $el: manuscriptEl }),
        file: ref({ source: "hello world hello there hello" }),
        cmView,
      });
      s.toggleScope("source");
      s.search("hello");

      expect(s.sourceMatchCount.value).toBe(3);
      view.destroy();
    });

    it("clears CM search on clear()", async () => {
      const { EditorState } = await import("@codemirror/state");
      const { EditorView } = await import("@codemirror/view");
      const { search: cmSearchExt, getSearchQuery } = await import("@codemirror/search");

      const state = EditorState.create({
        doc: "hello world",
        extensions: [cmSearchExt()],
      });
      const view = new EditorView({ state });
      const cmView = shallowRef(view);

      const s = useSearch({
        manuscriptRef: ref({ $el: manuscriptEl }),
        file: ref({ source: "hello world" }),
        cmView,
      });
      s.toggleScope("source");
      s.search("hello");
      expect(s.sourceMatchCount.value).toBe(1);

      s.clear();
      const sq = getSearchQuery(view.state);
      expect(sq.search).toBe("");
      expect(s.sourceMatchCount.value).toBe(0);
      view.destroy();
    });

    it("clears CM search when source scope is toggled off", async () => {
      const { EditorState } = await import("@codemirror/state");
      const { EditorView } = await import("@codemirror/view");
      const { search: cmSearchExt, getSearchQuery } = await import("@codemirror/search");

      const state = EditorState.create({
        doc: "hello world hello",
        extensions: [cmSearchExt()],
      });
      const view = new EditorView({ state });
      const cmView = shallowRef(view);

      const s = useSearch({
        manuscriptRef: ref({ $el: manuscriptEl }),
        file: ref({ source: "hello world hello" }),
        cmView,
      });
      s.toggleScope("source");
      s.search("hello");
      expect(s.sourceMatchCount.value).toBe(2);

      s.toggleScope("source"); // toggle off
      expect(s.sourceMatchCount.value).toBe(0);
      const sq = getSearchQuery(view.state);
      expect(sq.search).toBe("");
      view.destroy();
    });

    it("shows source-only hint text when only source scope active", async () => {
      const { EditorState } = await import("@codemirror/state");
      const { EditorView } = await import("@codemirror/view");
      const { search: cmSearchExt } = await import("@codemirror/search");

      const state = EditorState.create({
        doc: "hello world hello",
        extensions: [cmSearchExt()],
      });
      const view = new EditorView({ state });
      const cmView = shallowRef(view);

      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);

      const s = useSearch({
        manuscriptRef: ref({ $el: manuscriptEl }),
        file: ref({ source: "hello world hello" }),
        cmView,
      });
      s.toggleScope("source");
      s.toggleScope("output"); // only source active
      s.search("hello");

      expect(s.hintText.value).toBe("2 in source");
      view.destroy();
    });

    it("shows combined hint text when both output and source active", async () => {
      const { EditorState } = await import("@codemirror/state");
      const { EditorView } = await import("@codemirror/view");
      const { search: cmSearchExt } = await import("@codemirror/search");

      const state = EditorState.create({
        doc: "hello world",
        extensions: [cmSearchExt()],
      });
      const view = new EditorView({ state });
      const cmView = shallowRef(view);

      const s = useSearch({
        manuscriptRef: ref({ $el: manuscriptEl }),
        file: ref({ source: "hello world" }),
        cmView,
      });
      s.toggleScope("source"); // both output + source
      s.search("hello");

      // Output has 2 matches (from stubMatches), source has 1
      expect(s.hintText.value).toBe("1 of 2 in output, 1 in source");
      view.destroy();
    });

    it("calls findNext on CM view during next() when source active", async () => {
      const { EditorState } = await import("@codemirror/state");
      const { EditorView } = await import("@codemirror/view");
      const { search: cmSearchExt } = await import("@codemirror/search");

      const state = EditorState.create({
        doc: "aa bb aa cc aa",
        extensions: [cmSearchExt()],
      });
      const view = new EditorView({ state });
      const cmView = shallowRef(view);

      vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);

      const s = useSearch({
        manuscriptRef: ref({ $el: manuscriptEl }),
        file: ref({ source: "aa bb aa cc aa" }),
        cmView,
      });
      s.toggleScope("source");
      s.toggleScope("output"); // source only
      s.search("aa");

      // First search calls findNext, positioning on first match
      const sel1 = view.state.selection.main;
      expect(sel1.from).toBe(0);
      expect(sel1.to).toBe(2);

      // next() advances to second match
      s.next();
      const sel2 = view.state.selection.main;
      expect(sel2.from).toBe(6);
      expect(sel2.to).toBe(8);

      // prev() goes back
      s.prev();
      const sel3 = view.state.selection.main;
      expect(sel3.from).toBe(0);
      expect(sel3.to).toBe(2);

      view.destroy();
    });
  });
});
