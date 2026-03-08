import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import TopbarSearch from "@/views/workspace/TopbarSearch.vue";
import * as HSM from "@/utils/highlightSearchMatches.js";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

describe("TopbarSearch.vue", () => {
  const makeMark = () => ({
    scrollIntoView: vi.fn(),
    classList: { remove: vi.fn(), add: vi.fn() },
  });

  const stubMatches = [{ mark: makeMark() }, { mark: makeMark() }];

  beforeEach(() => {
    vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue(stubMatches);
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
    const manuscriptRef = overrides.manuscriptRef ?? ref({ $el: document.createElement("div") });
    const file = overrides.file ?? ref({ source: "test content" });
    return mount(TopbarSearch, {
      global: {
        provide: { manuscriptRef, file, showSearch },
        stubs: { ButtonClose: true, ButtonToggle: true },
      },
    });
  };

  it("renders search input", () => {
    const wrapper = createWrapper();
    expect(wrapper.find("[data-testid='search-input']").exists()).toBe(true);
  });

  it("renders nav buttons", () => {
    const wrapper = createWrapper();
    expect(wrapper.find("[data-testid='search-prev']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='search-next']").exists()).toBe(true);
  });

  it("renders advanced toggle button", () => {
    const wrapper = createWrapper();
    expect(wrapper.find("[data-testid='search-toggle-advanced']").exists()).toBe(true);
  });

  it("does not show scope chips in basic mode", () => {
    const wrapper = createWrapper();
    expect(wrapper.find("[data-testid='scope-chips']").exists()).toBe(false);
  });

  it("shows scope chips when advanced toggle is clicked", async () => {
    const wrapper = createWrapper();
    await wrapper.find("[data-testid='search-toggle-advanced']").trigger("click");
    expect(wrapper.find("[data-testid='scope-chips']").exists()).toBe(true);
  });

  it("renders all three scope chips in advanced mode", async () => {
    const wrapper = createWrapper();
    await wrapper.find("[data-testid='search-toggle-advanced']").trigger("click");
    const chips = wrapper.findAll("button-toggle-stub");
    expect(chips.length).toBe(3);
    expect(chips[0].attributes("text")).toBe("Output");
    expect(chips[1].attributes("text")).toBe("Source");
    expect(chips[2].attributes("text")).toBe("Marginalia");
  });

  it("output chip is active by default", async () => {
    const wrapper = createWrapper();
    await wrapper.find("[data-testid='search-toggle-advanced']").trigger("click");
    const outputChip = wrapper.find("[data-testid='scope-chip-output']");
    expect(outputChip.attributes("model-value")).toBe("true");
  });

  it("source chip is inactive by default", async () => {
    const wrapper = createWrapper();
    await wrapper.find("[data-testid='search-toggle-advanced']").trigger("click");
    const sourceChip = wrapper.find("[data-testid='scope-chip-source']");
    expect(sourceChip.attributes("model-value")).toBe("false");
  });

  it("performs search on Enter", async () => {
    const wrapper = createWrapper();
    const input = wrapper.find("[data-testid='search-input']");
    await input.setValue("hello");
    await input.trigger("keyup.enter");

    expect(HSM.highlightSearchMatches).toHaveBeenCalled();
  });

  it("shows match count after search", async () => {
    const wrapper = createWrapper();
    const input = wrapper.find("[data-testid='search-input']");
    await input.setValue("hello");
    await input.trigger("keyup.enter");

    expect(wrapper.find("[data-testid='search-hint']").text()).toBe("1 of 2");
  });

  it("navigates matches with prev/next buttons", async () => {
    const wrapper = createWrapper();
    const input = wrapper.find("[data-testid='search-input']");
    await input.setValue("test");
    await input.trigger("keyup.enter");

    await wrapper.find("[data-testid='search-next']").trigger("click");
    expect(wrapper.find("[data-testid='search-hint']").text()).toBe("2 of 2");

    await wrapper.find("[data-testid='search-prev']").trigger("click");
    expect(wrapper.find("[data-testid='search-hint']").text()).toBe("1 of 2");
  });

  it("clears search on first Escape", async () => {
    const wrapper = createWrapper();
    const input = wrapper.find("[data-testid='search-input']");
    await input.setValue("test");
    await input.trigger("keyup.enter");

    await input.trigger("keyup.escape");
    expect(HSM.clearHighlights).toHaveBeenCalled();
  });

  it("re-searches when Enter is pressed with a different query", async () => {
    const wrapper = createWrapper();
    const input = wrapper.find("[data-testid='search-input']");

    // First search
    await input.setValue("hello");
    await input.trigger("keyup.enter");
    expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(1);

    // Change query and press Enter again — should re-search, not navigate
    await input.setValue("world");
    await input.trigger("keyup.enter");
    expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(2);
  });

  it("navigates on Enter when query has not changed", async () => {
    const wrapper = createWrapper();
    const input = wrapper.find("[data-testid='search-input']");

    await input.setValue("hello");
    await input.trigger("keyup.enter");
    expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(1);

    // Same query, press Enter — should navigate, not re-search
    await input.trigger("keyup.enter");
    expect(HSM.highlightSearchMatches).toHaveBeenCalledTimes(1);
    expect(HSM.updateCurrentMatch).toHaveBeenCalled();
  });

  it("closes panel on Escape when not searching", async () => {
    const showSearch = ref(true);
    const wrapper = createWrapper({ showSearch });
    const input = wrapper.find("[data-testid='search-input']");

    await input.trigger("keyup.escape");
    expect(showSearch.value).toBe(false);
  });
});
