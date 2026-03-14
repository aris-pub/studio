/**
 * @file Unit tests for FilesItemRole component
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FilesItemRole from "@/views/home/FilesItemRole.vue";

const Badge = {
  name: "Badge",
  template: '<span class="badge"><slot /></span>',
};

function createWrapper(role) {
  return mount(FilesItemRole, {
    props: { role },
    global: { stubs: { Badge } },
  });
}

describe("FilesItemRole", () => {
  it("renders 'Editor' for EDITOR role", () => {
    const wrapper = createWrapper("EDITOR");
    expect(wrapper.find(".badge").text()).toBe("Editor");
  });

  it("renders 'Commenter' for COMMENTER role", () => {
    const wrapper = createWrapper("COMMENTER");
    expect(wrapper.find(".badge").text()).toBe("Commenter");
  });

  it("renders nothing when role is null", () => {
    const wrapper = createWrapper(null);
    expect(wrapper.find(".badge").exists()).toBe(false);
  });

  it("renders nothing for unknown role", () => {
    const wrapper = createWrapper("UNKNOWN");
    expect(wrapper.find(".badge").exists()).toBe(false);
  });
});
