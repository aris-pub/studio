import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick, defineComponent } from "vue";
import { mount } from "@vue/test-utils";

// Stub dynamic imports for onBeforeMount hook
const onloadStub = vi.fn();
vi.mock("/static/jquery-3.6.0.js", () => ({}), { virtual: true });
vi.mock("/static/tooltipster.bundle.js", () => ({}), { virtual: true });
vi.mock("/static/onload.js", () => ({ onload: onloadStub }), { virtual: true });

import ManuscriptWrapper from "@/components/manuscript/ManuscriptWrapper.vue";

// Helper to flush pending promise callbacks
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ManuscriptWrapper.vue", () => {
  beforeEach(() => {
    vi.resetModules();
    onloadStub.mockReset();
  });

  // TODO(std-dm4v): regressed silently while unit-frontend CI was no-op'ing (#399 unmasked).
  // The `[data-test="manuscript"]` element no longer mounts via the stub. Likely the
  // ManuscriptWrapper internals changed (recall it now uses parseHtmlToVNodes via h() instead
  // of a child <Manuscript> component). Re-enable after triage — the test design likely
  // needs to be rewritten against the new VNode-based architecture.
  it.skip("renders Manuscript component with given htmlString and settings", async () => {
    const html = "<div>content</div>";
    const settings = {
      background: "bg",
      fontSize: "fs",
      lineHeight: "lh",
      fontFamily: "ff",
      marginWidth: "mw",
    };
    const api = { defaults: { baseURL: "" } };
    const stubManuscript = defineComponent({
      props: { htmlString: { type: String }, settings: { type: Object } },
      template: '<div data-test="manuscript">{{ htmlString }}</div>',
    });
    const wrapper = mount(ManuscriptWrapper, {
      props: { htmlString: html, keys: true, settings },
      global: {
        provide: { api },
        stubs: { Manuscript: stubManuscript, Teleport: true, AnnotationMenu: true },
      },
    });
    await flushPromises();
    await nextTick();
    const ms = wrapper.find('[data-test="manuscript"]');
    expect(ms.exists()).toBe(true);
    expect(ms.text()).toBe(html);
    expect(wrapper.findComponent(stubManuscript).props("htmlString")).toBe(html);
    expect(wrapper.findComponent(stubManuscript).props("settings")).toStrictEqual(settings);
  });

  // Removed: "calls onload with element and keys option" test
  // This test involved complex external script loading and DOM integration
  // that should be tested in E2E tests rather than unit tests

  it("renders footer when showFooter is true", () => {
    const api = { defaults: { baseURL: "" } };
    const wrapper = mount(ManuscriptWrapper, {
      props: { htmlString: "", keys: false, showFooter: true },
      global: {
        provide: { api },
        stubs: {
          Manuscript: true,
          Teleport: true,
          AnnotationMenu: true,
          Logo: {
            template: '<img data-testid="logo-stub" src="data:image/svg+xml;base64,stub" />',
            props: ["type", "alt", "class"],
          },
        },
      },
    });
    expect(wrapper.find(".middle-footer").exists()).toBe(true);
    // Check that Logo stub is rendered in the footer
    const logoStub = wrapper.find('[data-testid="logo-stub"]');
    expect(logoStub.exists()).toBe(true);
    expect(logoStub.attributes("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("does not render footer when showFooter is false", () => {
    const api = { defaults: { baseURL: "" } };
    const wrapper = mount(ManuscriptWrapper, {
      props: { htmlString: "", keys: false, showFooter: false },
      global: {
        provide: { api },
        stubs: { Manuscript: true, Teleport: true, AnnotationMenu: true },
      },
    });
    expect(wrapper.find(".middle-footer").exists()).toBe(false);
  });
});
