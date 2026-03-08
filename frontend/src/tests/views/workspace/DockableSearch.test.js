import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, nextTick, defineComponent } from "vue";
import DockableSearch from "@/views/workspace/DockableSearch.vue";
import * as HSM from "@/utils/highlightSearchMatches.js";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

const SearchBarStub = defineComponent({
  name: "SearchBar",
  props: {
    withButtons: { type: Boolean },
    placeholder: { type: String },
    hintText: { type: String, default: "" },
    buttonsDisabled: { type: Boolean, default: false },
    size: { type: String, default: "default" },
    showIcon: { type: Boolean },
    buttonClose: { type: Boolean },
  },
  emits: ["submit", "next", "prev", "cancel"],
  setup(_, { expose, slots }) {
    const focusInput = vi.fn();
    expose({ focusInput });
    return () => [slots.default && slots.default(), slots.buttons && slots.buttons()];
  },
});

describe("DockableSearch.vue", () => {
  const stubMatches = [
    {
      mark: {
        scrollIntoView: vi.fn(),
        classList: { remove: vi.fn(), add: vi.fn() },
      },
    },
    {
      mark: {
        scrollIntoView: vi.fn(),
        classList: { remove: vi.fn(), add: vi.fn() },
      },
    },
  ];

  beforeEach(() => {
    vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(stubMatches);
    vi.spyOn(HSM, "highlightMathMatches").mockReturnValue([]);
    vi.spyOn(HSM, "clearHighlights").mockImplementation(() => {});
    vi.spyOn(HSM, "updateCurrentMatch").mockImplementation(() => {});
    vi.spyOn(KSMod, "useKeyboardShortcuts").mockImplementation(() => ({
      activate: vi.fn(),
      deactivate: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createWrapper = (overrides = {}) => {
    const showSearch = overrides.showSearch ?? ref(true);
    const manuscriptRef = overrides.manuscriptRef ?? ref({ $el: {} });
    const file = overrides.file ?? ref({ source: "" });
    return mount(DockableSearch, {
      global: {
        provide: { manuscriptRef, file, showSearch },
        stubs: { SearchBar: SearchBarStub, ButtonClose: true },
      },
    });
  };

  it("does not pass hintText before search", () => {
    const wrapper = createWrapper();
    const searchBar = wrapper.findComponent(SearchBarStub);
    expect(searchBar.props("hintText")).toBe("");
  });

  it("performs search and shows match count via hintText", async () => {
    const manuscriptRef = ref({ $el: {} });
    const file = ref({ source: "dummy source" });
    const wrapper = createWrapper({ manuscriptRef, file });
    const query = "term";

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", query);
    await nextTick();

    expect(HSM.highlightSearchMatches).toHaveBeenCalledWith(
      manuscriptRef.value.$el,
      query.trim(),
      {}
    );

    const searchBar = wrapper.findComponent(SearchBarStub);
    expect(searchBar.props("hintText")).toBe(`1 of ${stubMatches.length}`);

    await wrapper.findComponent(SearchBarStub).vm.$emit("next");
    await nextTick();
    expect(stubMatches[1].mark.scrollIntoView).toHaveBeenCalled();
    expect(wrapper.findComponent(SearchBarStub).props("hintText")).toBe(
      `2 of ${stubMatches.length}`
    );

    await wrapper.findComponent(SearchBarStub).vm.$emit("prev");
    await nextTick();
    expect(stubMatches[0].mark.scrollIntoView).toHaveBeenCalled();
    expect(wrapper.findComponent(SearchBarStub).props("hintText")).toBe(
      `1 of ${stubMatches.length}`
    );

    await wrapper.findComponent(SearchBarStub).vm.$emit("cancel");
    await nextTick();
    expect(HSM.clearHighlights).toHaveBeenCalledWith(manuscriptRef.value.$el);
    expect(wrapper.findComponent(SearchBarStub).props("hintText")).toBe("");
  });

  it("shows 'No matches' via hintText when search finds nothing", async () => {
    vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);
    const wrapper = createWrapper({ file: ref({ source: "no matching content" }) });

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", "nomatch");
    await nextTick();

    const searchBar = wrapper.findComponent(SearchBarStub);
    expect(searchBar.props("hintText")).toBe("No matches");
    expect(searchBar.props("buttonsDisabled")).toBe(true);
  });

  it("close button sets showSearch to false", async () => {
    const showSearch = ref(true);
    const wrapper = createWrapper({ showSearch });

    wrapper.vm.closePanel();
    await nextTick();

    expect(showSearch.value).toBe(false);
  });

  it("cancel event on empty search closes panel", async () => {
    const showSearch = ref(true);
    const wrapper = createWrapper({ showSearch });

    await wrapper.findComponent(SearchBarStub).vm.$emit("cancel");
    await nextTick();

    expect(showSearch.value).toBe(false);
  });

  it("handles empty search strings gracefully", async () => {
    const wrapper = createWrapper({ file: ref({ source: "test content" }) });

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", "");
    await nextTick();

    expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SearchBarStub).props("hintText")).toBe("");
  });

  it("handles whitespace-only search strings", async () => {
    const wrapper = createWrapper({ file: ref({ source: "test content" }) });

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", "   \t  \n  ");
    await nextTick();

    expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
    expect(wrapper.findComponent(SearchBarStub).props("hintText")).toBe("");
  });

  it("handles navigation with no matches", async () => {
    vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);
    const wrapper = createWrapper({ file: ref({ source: "no matching content" }) });

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", "nomatch");
    await nextTick();

    expect(wrapper.exists()).toBe(true);

    await wrapper.findComponent(SearchBarStub).vm.$emit("next");
    await nextTick();
    await wrapper.findComponent(SearchBarStub).vm.$emit("prev");
    await nextTick();

    expect(wrapper.exists()).toBe(true);
  });

  it("handles circular navigation through matches", async () => {
    const wrapper = createWrapper({ file: ref({ source: "content" }) });

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", "test");
    await nextTick();

    await wrapper.findComponent(SearchBarStub).vm.$emit("prev");
    await nextTick();
    expect(stubMatches[1].mark.scrollIntoView).toHaveBeenCalled();
    expect(wrapper.findComponent(SearchBarStub).props("hintText")).toBe(
      `2 of ${stubMatches.length}`
    );

    await wrapper.findComponent(SearchBarStub).vm.$emit("next");
    await nextTick();
    expect(stubMatches[0].mark.scrollIntoView).toHaveBeenCalled();
    expect(wrapper.findComponent(SearchBarStub).props("hintText")).toBe(
      `1 of ${stubMatches.length}`
    );
  });

  it("focuses search input on mount", async () => {
    const mockFocusInput = vi.fn();
    const SearchBarWithFocus = defineComponent({
      name: "SearchBar",
      setup(_, { expose }) {
        expose({ focusInput: mockFocusInput });
        return () => null;
      },
    });

    mount(DockableSearch, {
      global: {
        provide: {
          manuscriptRef: ref({ $el: {} }),
          file: ref({ source: "" }),
          showSearch: ref(true),
        },
        stubs: { SearchBar: SearchBarWithFocus, ButtonClose: true },
      },
    });

    await nextTick();
    expect(mockFocusInput).toHaveBeenCalled();
  });

  it("handles manuscript ref not being available", async () => {
    const wrapper = createWrapper({
      manuscriptRef: ref(null),
      file: ref({ source: "test content" }),
    });

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", "test");
    await nextTick();

    expect(HSM.highlightSearchMatches).not.toHaveBeenCalled();
    expect(wrapper.exists()).toBe(true);
  });

  it("updates current match highlighting during navigation", async () => {
    const wrapper = createWrapper({ file: ref({ source: "test content" }) });

    await wrapper.findComponent(SearchBarStub).vm.$emit("submit", "test");
    await nextTick();

    await wrapper.findComponent(SearchBarStub).vm.$emit("next");
    await nextTick();
    expect(HSM.updateCurrentMatch).toHaveBeenCalledWith(stubMatches, 1);

    await wrapper.findComponent(SearchBarStub).vm.$emit("prev");
    await nextTick();
    expect(HSM.updateCurrentMatch).toHaveBeenCalledWith(stubMatches, 0);
  });
});
