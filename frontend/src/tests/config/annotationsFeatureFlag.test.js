// std-cid4 — annotations/comments/reactions are hidden for the closed beta via
// the `annotationsEnabled` feature flag. These tests force the flag OFF and prove
// each gated entry point does not render. Each assertion is self-validating: a
// sibling element that is NOT gated (manuscript mount point, section ticks,
// output/source scope chips) is asserted present, so an absent annotation
// element means the gate worked, not that the component failed to mount.
//
// Existing suites run with the flag ON (VITE_FEATURE_ANNOTATIONS="true" in
// vite.config test.env) and already cover the enabled behavior.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";

// Force the beta behavior (feature OFF) for this whole file.
vi.mock("@/config/features.js", () => ({ annotationsEnabled: false }));

// ManuscriptWrapper loads RSM assets via dynamic import in onBeforeMount.
const onloadStub = vi.fn();
vi.mock("/static/onload.js", () => ({ onload: onloadStub }), { virtual: true });

// Feed ScrollbarMinimap annotation + feedback marks so we prove they are
// filtered at render time even when the underlying data is present.
vi.mock("@/composables/useMinimapMarks.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    useMinimapMarks: vi.fn(() => ({
      marks: ref([
        { top: 0.1, color: "var(--gray-300)", type: "section", id: "s1", level: 1 },
        { top: 0.5, color: "var(--purple-600)", type: "annotation", id: "a1", label: "note" },
        { top: 0.7, color: "var(--red-400)", type: "feedback", id: "f1", label: "Heart" },
      ]),
      computeMarks: vi.fn(),
    })),
  };
});

import ManuscriptWrapper from "@/components/manuscript/ManuscriptWrapper.vue";
import ScrollbarMinimap from "@/views/workspace/ScrollbarMinimap.vue";
import TopbarSearch from "@/views/workspace/TopbarSearch.vue";
import * as HSM from "@/utils/highlightSearchMatches.js";
import * as KSMod from "@/composables/useKeyboardShortcuts.js";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("annotations feature flag OFF", () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  it("ManuscriptWrapper renders the manuscript but not the selection AnnotationMenu", async () => {
    const api = { defaults: { baseURL: "" } };
    wrapper = mount(ManuscriptWrapper, {
      props: { htmlString: "<div>content</div>", keys: false },
      global: {
        provide: { api },
        stubs: {
          Teleport: true,
          AnnotationMenu: {
            name: "AnnotationMenuStub",
            template: '<div data-testid="annotation-menu-stub"></div>',
          },
        },
      },
    });
    await flushPromises();

    // Control: the manuscript itself renders (mount succeeded).
    expect(wrapper.find(".manuscriptwrapper").exists()).toBe(true);
    // Gate: the Mark/Note/Comment toolbar is not mounted.
    expect(wrapper.find('[data-testid="annotation-menu-stub"]').exists()).toBe(false);
  });

  it("ScrollbarMinimap renders section ticks but hides annotation and reaction ticks", () => {
    wrapper = mount(ScrollbarMinimap, {
      props: { file: { id: 1, html: "<p>content</p>", source: "# hi" } },
      global: {
        provide: {
          manuscriptRef: ref(null),
          annotations: ref([]),
          reactions: ref([]),
          awareness: ref(null),
          columnSizes: { inner: { height: 400 } },
        },
      },
    });

    // Control: non-annotation marks still render.
    expect(wrapper.findAll(".mm-section").length).toBe(1);
    // Gate: annotation and reaction (feedback) ticks are gone.
    expect(wrapper.findAll(".mm-annotation").length).toBe(0);
    expect(wrapper.findAll(".mm-feedback").length).toBe(0);
  });

  it("TopbarSearch advanced scopes exclude the Marginalia chip", async () => {
    vi.spyOn(HSM, "highlightSearchMatches").mockReturnValue([]);
    vi.spyOn(HSM, "clearHighlights").mockImplementation(() => {});
    vi.spyOn(HSM, "updateCurrentMatch").mockImplementation(() => {});
    vi.spyOn(KSMod, "useKeyboardShortcuts").mockImplementation(() => ({
      activate: vi.fn(),
      deactivate: vi.fn(),
    }));

    wrapper = mount(TopbarSearch, {
      global: {
        provide: {
          manuscriptRef: ref({ $el: document.createElement("div") }),
          file: ref({ source: "test content" }),
          showSearch: ref(true),
        },
        stubs: { ButtonClose: true, ButtonToggle: true },
      },
    });

    await wrapper.find("[data-testid='search-toggle-advanced']").trigger("click");

    // Control: the non-annotation scopes still render.
    expect(wrapper.find("[data-testid='scope-chip-output']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='scope-chip-source']").exists()).toBe(true);
    // Gate: the annotation-targeting Marginalia scope is gone.
    expect(wrapper.find("[data-testid='scope-chip-marginalia']").exists()).toBe(false);
    expect(wrapper.findAll("button-toggle-stub").length).toBe(2);
  });
});
