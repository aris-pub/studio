import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import HomeView from "@/views/home/View.vue";

// Mock dependencies
vi.mock("@/models/File.js", () => ({
  File: {
    openFile: vi.fn(),
  },
}));

describe("HomeView", () => {
  it("renders BaseLayout with context sub-items and FilesPane present", () => {
    const wrapper = mount(HomeView, {
      global: {
        provide: {
          fileStore: {
            value: {
              getRecentFiles: vi.fn(() => []),
              loadFiles: vi.fn(),
              loadTags: vi.fn(),
              filesLoaded: { value: true },
            },
          },
        },
        stubs: {
          BaseLayout: { name: "BaseLayout", template: "<div><slot/></div>" },
          FilesPane: { name: "FilesPane", template: '<div data-test="files-pane" />' },
        },
      },
    });
    const layout = wrapper.findComponent({ name: "BaseLayout" });
    expect(layout.exists()).toBe(true);
    expect(wrapper.find('[data-test="files-pane"]').exists()).toBe(true);
  });
});
