import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import DangerZone from "@/views/account/DangerZone.vue";

vi.mock("@/utils/toast.js", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe("DangerZone", () => {
  let wrapper;
  let user;
  let api;
  let toast;
  const stubs = {
    Section: {
      template: '<div><slot name="title"/><slot name="content"/></div>',
      props: ["variant", "class"],
    },
    InputText: { template: '<input v-bind="$attrs" />' },
    Button: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot/></button>' },
    Icon: { template: '<span class="icon-mock"></span>' },
  };

  beforeEach(async () => {
    const { toast: toastModule } = await import("@/utils/toast.js");
    toast = toastModule;
    vi.clearAllMocks();

    user = ref({ id: 1, name: "Alice" });
    api = {
      delete: vi.fn().mockResolvedValue({ data: "success" }),
    };
    wrapper = mount(DangerZone, {
      global: {
        stubs,
        provide: { user, api },
      },
    });
  });

  it("requires DELETE confirmation text", async () => {
    wrapper.vm.deleteConfirmText = "wrong";
    await wrapper.vm.onDeleteAccount();
    expect(toast.error).toHaveBeenCalledWith('Please type "DELETE" to confirm account deletion');
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("clears localStorage on successful deletion", async () => {
    localStorage.setItem("accessToken", "test-token");
    localStorage.setItem("refreshToken", "test-refresh");
    localStorage.setItem("user", JSON.stringify({ id: 1 }));

    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      set href(_) {},
      get href() {
        return "http://localhost/account";
      },
    });

    wrapper.vm.deleteConfirmText = "DELETE";
    await wrapper.vm.onDeleteAccount();

    expect(api.delete).toHaveBeenCalledWith("/users/1");
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();

    window.location.mockRestore?.();
  });

  it("does not clear localStorage on deletion failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("accessToken", "test-token");
    api.delete.mockRejectedValue(new Error("Server error"));

    wrapper.vm.deleteConfirmText = "DELETE";
    await wrapper.vm.onDeleteAccount();

    expect(localStorage.getItem("accessToken")).toBe("test-token");
    console.error.mockRestore();
  });

  it("prevents concurrent deletion requests", async () => {
    let resolveDelete;
    api.delete.mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      })
    );

    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      set href(_) {},
      get href() {
        return "http://localhost/account";
      },
    });

    wrapper.vm.deleteConfirmText = "DELETE";
    const first = wrapper.vm.onDeleteAccount();
    wrapper.vm.onDeleteAccount(); // should be ignored

    resolveDelete({ data: "success" });
    await first;

    expect(api.delete).toHaveBeenCalledTimes(1);
    window.location.mockRestore?.();
  });
});
