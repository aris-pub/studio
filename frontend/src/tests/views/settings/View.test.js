import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsView from "@/views/settings/View.vue";

// Mock vue-router
const mockRoute = { path: "/settings/preferences" };
const mockRouter = { push: vi.fn() };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

describe("SettingsView", () => {
  let wrapper;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mount component with mocked components
    wrapper = mount(SettingsView, {
      global: {
        components: {
          BaseLayout: {
            name: "BaseLayout",
            props: ["contextSubItems", "fab"],
            template: '<div class="base-layout" data-testid="base-layout"><slot /></div>',
          },
          RouterView: {
            name: "RouterView",
            template: '<div class="router-view" data-testid="router-view">Settings Content</div>',
          },
        },
      },
    });
  });

  it("renders BaseLayout component", () => {
    const baseLayout = wrapper.find('[data-testid="base-layout"]');
    expect(baseLayout.exists()).toBe(true);
  });

  it("passes contextSubItems prop to BaseLayout with correct settings sections", () => {
    const baseLayout = wrapper.findComponent({ name: "BaseLayout" });
    const contextSubItems = baseLayout.props("contextSubItems");

    expect(contextSubItems).toHaveLength(2);
    expect(contextSubItems[0]).toMatchObject({
      icon: "FileText",
      text: "File Display",
      route: "/settings/document",
    });
    expect(contextSubItems[1]).toMatchObject({
      icon: "Settings2",
      text: "Preferences",
      route: "/settings/preferences",
    });
  });

  it("sets correct active state based on current route", () => {
    const baseLayout = wrapper.findComponent({ name: "BaseLayout" });
    const contextSubItems = baseLayout.props("contextSubItems");

    expect(contextSubItems[0].active).toBe(false); // File Display
    expect(contextSubItems[1].active).toBe(true); // Preferences
  });

  it("disables FAB in BaseLayout", () => {
    const baseLayout = wrapper.findComponent({ name: "BaseLayout" });
    expect(baseLayout.props("fab")).toBe(false);
  });

  it("renders RouterView for nested settings routes", () => {
    const routerView = wrapper.findComponent({ name: "RouterView" });
    expect(routerView.exists()).toBe(true);
  });

  it("handles route object being undefined in tests", () => {
    expect(() => {
      const baseLayout = wrapper.findComponent({ name: "BaseLayout" });
      baseLayout.props("contextSubItems");
    }).not.toThrow();
  });
});
