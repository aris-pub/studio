import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";

// Helper to flush pending promise callbacks
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Abstract.vue", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  it("renders loading state when file has no id", async () => {
    const stubMw = defineComponent({
      name: "ManuscriptWrapper",
      props: {
        htmlString: { type: String },
        keys: { type: Array },
      },
      template: '<div data-test="mw">{{ htmlString }}</div>',
    });
    const api = { get: vi.fn() };
    const { default: Abstract } = await import("@/components/manuscript/Abstract.vue");
    const wrapper = mount(Abstract, {
      props: { file: {} },
      global: {
        provide: { api },
        stubs: { ManuscriptWrapper: stubMw },
      },
    });
    await flushPromises();
    await nextTick();
    const mw = wrapper.findComponent(stubMw);
    expect(mw.exists()).toBe(true);
    expect(mw.text()).toBe("<div>loading abstract...</div>");
    expect(mw.props("keys")).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("fetches and displays abstract content", async () => {
    const stubMw = defineComponent({
      name: "ManuscriptWrapper",
      props: {
        htmlString: { type: String },
        keys: { type: Array },
      },
      template: '<div data-test="mw">{{ htmlString }}</div>',
    });
    const get = vi.fn(() => Promise.resolve({ data: "Hello world" }));
    const api = { get };
    const { default: Abstract } = await import("@/components/manuscript/Abstract.vue");
    const wrapper = mount(Abstract, {
      props: { file: { id: "123" } },
      global: {
        provide: { api },
        stubs: { ManuscriptWrapper: stubMw },
      },
    });
    await flushPromises();
    await nextTick();
    expect(get).toHaveBeenCalledWith("/files/123/content/abstract?handrails=false");
    const mw = wrapper.findComponent(stubMw);
    expect(mw.text()).toBe("Hello world");
  });

  it("truncates long abstract content", async () => {
    const stubMw = defineComponent({
      name: "ManuscriptWrapper",
      props: {
        htmlString: { type: String },
        keys: { type: Array },
      },
      template: '<div data-test="mw">{{ htmlString }}</div>',
    });
    const longText = "a".repeat(500);
    const get = vi.fn(() => Promise.resolve({ data: longText }));
    const api = { get };
    const { default: Abstract } = await import("@/components/manuscript/Abstract.vue");
    const wrapper = mount(Abstract, {
      props: { file: { id: "456" } },
      global: {
        provide: { api },
        stubs: { ManuscriptWrapper: stubMw },
      },
    });
    await flushPromises();
    await nextTick();
    const mw = wrapper.findComponent(stubMw);
    expect(mw.text()).toHaveLength(303);
    expect(mw.text().endsWith("...")).toBe(true);
  });

  it("displays an error message when fetch fails", async () => {
    const stubMw = defineComponent({
      name: "ManuscriptWrapper",
      props: {
        htmlString: { type: String },
        keys: { type: Array },
      },
      template: '<div data-test="mw">{{ htmlString }}</div>',
    });
    const get = vi.fn(() => Promise.reject(new Error("fail")));
    const api = { get };
    const { default: Abstract } = await import("@/components/manuscript/Abstract.vue");
    const wrapper = mount(Abstract, {
      props: { file: { id: "789" } },
      global: {
        provide: { api },
        stubs: { ManuscriptWrapper: stubMw },
      },
    });
    await flushPromises();
    await nextTick();
    const mw = wrapper.findComponent(stubMw);
    expect(mw.text()).toBe("<div>error when retrieving abstract!</div>");
  });

  it("re-fetches when file prop changes", async () => {
    const stubMw = defineComponent({
      name: "ManuscriptWrapper",
      props: {
        htmlString: { type: String },
        keys: { type: Array },
      },
      template: '<div data-test="mw">{{ htmlString }}</div>',
    });
    const get = vi.fn((url) => {
      if (url.includes("/1/")) return Promise.resolve({ data: "one" });
      return Promise.resolve({ data: "two" });
    });
    const api = { get };
    const { default: Abstract } = await import("@/components/manuscript/Abstract.vue");
    const wrapper = mount(Abstract, {
      props: { file: { id: "1" } },
      global: {
        provide: { api },
        stubs: { ManuscriptWrapper: stubMw },
      },
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.findComponent(stubMw).text()).toBe("one");
    await wrapper.setProps({ file: { id: "2" } });
    await flushPromises();
    await nextTick();
    expect(wrapper.findComponent(stubMw).text()).toBe("two");
  });
});
