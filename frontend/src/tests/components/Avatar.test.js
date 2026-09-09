import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import Avatar from "@/components/base/Avatar.vue";

const createObjectURLMock = vi.fn(() => "blob-url");
const revokeObjectURLMock = vi.fn();
vi.stubGlobal("URL", {
  createObjectURL: createObjectURLMock,
  revokeObjectURL: revokeObjectURLMock,
});

describe("Avatar.vue", () => {
  let api;
  let wrapper;

  beforeEach(() => {
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
  });

  async function mountAvatarWith(userValue, apiMock) {
    api = apiMock;
    wrapper = mount(Avatar, {
      props: { user: userValue },
      global: {
        provide: {
          api,
        },
      },
    });
    await nextTick();
    await nextTick();
    return wrapper;
  }

  it("renders user initials when api.get fails and user.initials provided", async () => {
    const userValue = { id: 1, name: "Alice", initials: "AL", avatar_color: "blue" };
    api = { get: vi.fn().mockRejectedValue(new Error("not found")) };
    wrapper = await mountAvatarWith(userValue, api);

    expect(api.get).toHaveBeenCalledWith("/users/1/avatar", { responseType: "blob" });
    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    const container = wrapper.get(".av-wrapper");
    expect(container.classes()).not.toContain("has-avatar");
    expect(container.element.style.backgroundColor).toBe("blue");
    expect(container.element.style.backgroundImage).toBe("none");

    const name = wrapper.get(".av-name");
    expect(name.text()).toBe("AL");
  });

  it("renders first character of user.name when no initials and api.get fails", async () => {
    const userValue = { id: 2, name: "Bob", avatar_color: "green" };
    api = { get: vi.fn().mockRejectedValue(new Error("not found")) };
    wrapper = await mountAvatarWith(userValue, api);

    const name = wrapper.get(".av-name");
    expect(name.text()).toBe("B");
  });

  it("fetches avatar and renders background image on success", async () => {
    const blob = new Blob(["data"], { type: "image/png" });
    const userValue = { id: 3, name: "Carol", initials: "C", avatar_color: "red" };
    api = { get: vi.fn().mockResolvedValue({ data: blob }) };
    wrapper = await mountAvatarWith(userValue, api);

    expect(api.get).toHaveBeenCalledWith("/users/3/avatar", { responseType: "blob" });
    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    const container = wrapper.get(".av-wrapper");
    expect(container.classes()).toContain("has-avatar");
    expect(container.element.style.backgroundColor).toBe("transparent");
    expect(container.element.style.backgroundImage).toBe('url("blob-url")');
    expect(wrapper.find(".av-name").exists()).toBe(false);
  });
});

// Regression: UserMenu passes the injected app-level user straight in, and that
// ref is null until App.vue finishes auth init. Avatar must not crash on it.
describe("Avatar.vue with no user", () => {
  it("renders without throwing when user is null", () => {
    const api = { get: vi.fn().mockRejectedValue(new Error("no avatar")) };
    const wrapper = mount(Avatar, {
      props: { user: null },
      global: { provide: { api } },
    });

    expect(wrapper.find(".av-wrapper").exists()).toBe(true);
    expect(wrapper.text()).toBe("");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("renders without throwing when user is undefined", () => {
    const api = { get: vi.fn().mockRejectedValue(new Error("no avatar")) };
    const wrapper = mount(Avatar, {
      props: { user: undefined },
      global: { provide: { api } },
    });

    expect(wrapper.find(".av-wrapper").exists()).toBe(true);
  });

  it("renders without throwing when a null user is passed at size sm", () => {
    const api = { get: vi.fn().mockRejectedValue(new Error("no avatar")) };
    const wrapper = mount(Avatar, {
      props: { user: null, size: "sm" },
      global: { provide: { api } },
    });

    expect(wrapper.find(".av-wrapper").exists()).toBe(true);
  });
});
