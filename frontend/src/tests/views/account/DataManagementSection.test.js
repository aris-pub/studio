import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import DataManagementSection from "@/views/account/DataManagementSection.vue";

vi.mock("@/utils/toast.js", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe("DataManagementSection", () => {
  let wrapper;
  let user;
  let api;
  let toast;
  const stubs = {
    Section: {
      template: '<div><slot name="title"/><slot name="content"/></div>',
      props: ["variant"],
    },
    Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot/></button>' },
    Icon: { template: '<span class="icon-mock"></span>' },
  };

  beforeEach(async () => {
    const { toast: toastModule } = await import("@/utils/toast.js");
    toast = toastModule;
    vi.clearAllMocks();

    user = ref({ id: 1, name: "Alice" });
    api = {
      get: vi.fn().mockResolvedValue({ data: new Blob(["{}"], { type: "application/json" }) }),
    };

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob-url"),
      revokeObjectURL: vi.fn(),
    });

    wrapper = mount(DataManagementSection, {
      global: {
        stubs,
        provide: { user, api },
      },
    });
  });

  it("exports data successfully", async () => {
    const mockLink = { href: "", setAttribute: vi.fn(), click: vi.fn(), remove: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return mockLink;
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {});

    await wrapper.vm.onExportData();
    expect(api.get).toHaveBeenCalledWith("/users/1/export", { responseType: "blob" });
    expect(toast.success).toHaveBeenCalledWith("Data export downloaded successfully");

    document.createElement.mockRestore();
    document.body.appendChild.mockRestore();
  });

  it("handles export failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.get.mockRejectedValue(new Error("Export failed"));
    await wrapper.vm.onExportData();
    expect(toast.error).toHaveBeenCalledWith("Failed to export data", expect.any(Object));
    console.error.mockRestore();
  });

  it("prevents concurrent exports", async () => {
    const mockLink = { href: "", setAttribute: vi.fn(), click: vi.fn(), remove: vi.fn() };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return mockLink;
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {});

    let resolveExport;
    api.get.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));

    const first = wrapper.vm.onExportData();
    wrapper.vm.onExportData();

    resolveExport({ data: new Blob(["{}"]) });
    await first;

    expect(api.get).toHaveBeenCalledTimes(1);

    document.createElement.mockRestore();
    document.body.appendChild.mockRestore();
  });
});
