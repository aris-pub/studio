/**
 * @file Unit tests for DrawerShare component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import DrawerShare from "@/views/workspace/DrawerShare.vue";

// Mock downloadBlob to avoid DOM manipulation in jsdom
vi.mock("@/utils/download.js", () => ({
  downloadBlob: vi.fn(),
}));

const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
};

const mockUser = {
  value: {
    id: 1,
    name: "Ada Lovelace",
    email: "ada@example.com",
    avatar_color: "#7629c7",
  },
};

const mockFile = {
  id: 123,
  ownerId: 1,
  title: "Quantum Effects in Neural Networks",
  tags: [
    { id: 1, name: "quantum" },
    { id: 2, name: "neural" },
  ],
};

describe("DrawerShare", () => {
  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((url) => {
      if (url.includes("/permissions")) return Promise.resolve({ data: [] });
      if (url.includes("/abstract"))
        return Promise.resolve({ data: { html: "<p>We present a novel approach.</p>" } });
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  function createWrapper(options = {}) {
    const fileToUse = options.file || mockFile;
    return mount(DrawerShare, {
      global: {
        provide: {
          api: mockApi,
          user: options.user || mockUser,
          file: { value: fileToUse },
        },
        stubs: {
          Pane: {
            name: "Pane",
            template: '<div class="pane-stub"><slot name="header" /><slot /></div>',
          },
          Section: {
            name: "Section",
            template:
              '<div class="section-stub"><div class="section-title"><slot name="title" /></div><div class="section-content"><slot name="content" /></div></div>',
          },
          Icon: {
            name: "Icon",
            template: '<span class="icon-stub" />',
            props: ["name"],
          },
          Button: {
            name: "Button",
            template:
              '<button class="button-stub" @click="$emit(\'click\')" :disabled="disabled">{{ text }}</button>',
            props: ["kind", "size", "icon", "text", "disabled"],
            emits: ["click"],
          },
          Avatar: {
            name: "Avatar",
            template: '<span class="avatar-stub" />',
            props: ["user", "size", "tooltip"],
          },
          Badge: {
            name: "Badge",
            template: '<span class="badge"><slot /></span>',
            props: ["variant", "size"],
          },
          BaseInput: {
            name: "BaseInput",
            template: `<div class="base-input-stub">
              <input
                class="invite-input"
                :value="modelValue"
                :placeholder="placeholder"
                @input="$emit('update:modelValue', $event.target.value)"
              />
              <span v-if="error" class="invite-error">{{ error }}</span>
            </div>`,
            props: ["modelValue", "placeholder", "direction", "size", "error", "ariaLabel"],
            emits: ["update:modelValue"],
          },
          SelectBox: {
            name: "SelectBox",
            template: '<span class="select-box-stub">{{ currentLabel }}</span>',
            props: ["modelValue", "options"],
            emits: ["update:modelValue"],
            computed: {
              currentLabel() {
                const opt = (this.options || []).find((o) =>
                  typeof o === "object" ? o.value === this.modelValue : o === this.modelValue
                );
                return opt ? (typeof opt === "object" ? opt.label : opt) : "";
              },
            },
          },
        },
      },
    });
  }

  describe("rendering", () => {
    it("renders pane with Share header", () => {
      wrapper = createWrapper();
      expect(wrapper.find("h3").text()).toBe("Share");
    });

    it("renders two sections (People and Publish)", () => {
      wrapper = createWrapper();
      const sections = wrapper.findAll(".section-stub");
      expect(sections).toHaveLength(2);
    });

    it("renders People section title", () => {
      wrapper = createWrapper();
      const titles = wrapper.findAll(".section-title");
      expect(titles[0].text()).toBe("People");
    });

    it("renders Publish to Press section title", () => {
      wrapper = createWrapper();
      const titles = wrapper.findAll(".section-title");
      expect(titles[1].text()).toBe("Publish to Press");
    });
  });

  describe("people section", () => {
    it("displays owner with Avatar component", () => {
      wrapper = createWrapper();
      const avatar = wrapper.findComponent({ name: "Avatar" });
      expect(avatar.exists()).toBe(true);
    });

    it("displays owner name", () => {
      wrapper = createWrapper();
      const name = wrapper.find(".person-name");
      expect(name.text()).toBe("Ada Lovelace");
    });

    it("displays Owner role badge", () => {
      wrapper = createWrapper();
      const badge = wrapper.find(".badge");
      expect(badge.text()).toBe("Owner");
    });

    it("falls back to email when name is missing", () => {
      wrapper = createWrapper({
        user: { value: { id: 1, email: "ada@example.com" } },
      });
      const name = wrapper.find(".person-name");
      expect(name.text()).toBe("ada@example.com");
    });

    it("shows invite controls for owner", () => {
      wrapper = createWrapper();
      const input = wrapper.findComponent({ name: "BaseInput" });
      expect(input.exists()).toBe(true);
      expect(input.props("placeholder")).toBe("Add by email address");
    });

    it("hides invite controls for non-owner", () => {
      wrapper = createWrapper({
        user: { value: { id: 2, name: "Bob", email: "bob@example.com" } },
        file: { ...mockFile, ownerId: 1 },
      });
      expect(wrapper.findComponent({ name: "BaseInput" }).exists()).toBe(false);
    });

    it("shows role selector defaulting to Editor", () => {
      wrapper = createWrapper();
      const select = wrapper.findComponent({ name: "SelectBox" });
      expect(select.exists()).toBe(true);
      expect(select.text()).toBe("Editor");
    });

    it("shows Add button", () => {
      wrapper = createWrapper();
      const buttons = wrapper.findAllComponents({ name: "Button" });
      const addBtn = buttons.find((b) => b.props("text") === "Add");
      expect(addBtn).toBeDefined();
    });

    it("renders collaborator rows from API", async () => {
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) {
          return Promise.resolve({
            data: [
              {
                permission_id: 10,
                user_id: 2,
                user_name: "Bob Smith",
                user_email: "bob@example.com",
                role: "EDITOR",
              },
            ],
          });
        }
        if (url.includes("/abstract")) return Promise.resolve({ data: { html: "" } });
        return Promise.resolve({ data: {} });
      });

      wrapper = createWrapper();
      await flushPromises();

      const rows = wrapper.findAll(".person-row");
      expect(rows).toHaveLength(2);
      expect(rows[1].find(".person-name").text()).toBe("Bob Smith");
      expect(rows[1].find(".badge").text()).toBe("Editor");
    });

    it("renders 'Commenter' badge for COMMENTER role", async () => {
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) {
          return Promise.resolve({
            data: [
              {
                permission_id: 11,
                user_id: 3,
                user_name: "Carol",
                user_email: "carol@example.com",
                role: "COMMENTER",
              },
            ],
          });
        }
        if (url.includes("/abstract")) return Promise.resolve({ data: { html: "" } });
        return Promise.resolve({ data: {} });
      });

      wrapper = createWrapper();
      await flushPromises();

      const rows = wrapper.findAll(".person-row");
      expect(rows[1].find(".badge").text()).toBe("Commenter");
    });

    it("uses Avatar for collaborator rows", async () => {
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) {
          return Promise.resolve({
            data: [
              {
                permission_id: 10,
                user_id: 2,
                user_name: "Bob",
                user_email: "bob@example.com",
                role: "EDITOR",
              },
            ],
          });
        }
        return Promise.resolve({ data: {} });
      });

      wrapper = createWrapper();
      await flushPromises();

      const avatars = wrapper.findAllComponents({ name: "Avatar" });
      expect(avatars).toHaveLength(2);
    });

    it("shows remove button on collaborator rows for owner", async () => {
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) {
          return Promise.resolve({
            data: [
              {
                permission_id: 10,
                user_id: 2,
                user_name: "Bob",
                user_email: "bob@example.com",
                role: "EDITOR",
              },
            ],
          });
        }
        return Promise.resolve({ data: {} });
      });

      wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.find(".person-remove").exists()).toBe(true);
    });
  });

  describe("invite flow", () => {
    it("adds collaborator on valid email submit", async () => {
      mockApi.post.mockImplementation((url) => {
        if (url.includes("/lookup")) return Promise.resolve({ data: { user_id: 5 } });
        if (url.includes("/permissions")) return Promise.resolve({ data: { id: 20 } });
        return Promise.resolve({ data: {} });
      });

      wrapper = createWrapper();
      await flushPromises();

      const input = wrapper.find(".invite-input");
      await input.setValue("bob@example.com");
      await wrapper.find(".invite-group").trigger("keydown.enter");
      await flushPromises();

      expect(mockApi.post).toHaveBeenCalledWith("/users/lookup", { email: "bob@example.com" });
      expect(mockApi.post).toHaveBeenCalledWith("/files/123/permissions", {
        user_id: 5,
        role: "EDITOR",
      });
    });

    it("shows error for invalid email on submit", async () => {
      wrapper = createWrapper();
      await flushPromises();

      const input = wrapper.find(".invite-input");
      await input.setValue("not-an-email");
      await wrapper.find(".invite-group").trigger("keydown.enter");
      await flushPromises();

      expect(wrapper.find(".invite-error").text()).toBe("Enter a valid email address");
    });

    it("shows error for empty input on submit", async () => {
      wrapper = createWrapper();
      await flushPromises();

      await wrapper.find(".invite-group").trigger("keydown.enter");
      await flushPromises();

      expect(wrapper.find(".invite-error").text()).toBe("Enter an email address");
    });

    it("shows self-invite error", async () => {
      wrapper = createWrapper();
      await flushPromises();

      const input = wrapper.find(".invite-input");
      await input.setValue("ada@example.com");
      await wrapper.find(".invite-group").trigger("keydown.enter");
      await flushPromises();

      expect(wrapper.find(".invite-error").text()).toBe("You can't invite yourself");
    });

    it("shows no-account error on 404", async () => {
      mockApi.post.mockRejectedValue({ response: { status: 404, data: {} } });

      wrapper = createWrapper();
      await flushPromises();

      const input = wrapper.find(".invite-input");
      await input.setValue("nobody@example.com");
      await wrapper.find(".invite-group").trigger("keydown.enter");
      await flushPromises();

      expect(wrapper.find(".invite-error").text()).toBe("No account found for this email");
    });

    it("shows already-has-access error on 400", async () => {
      mockApi.post.mockRejectedValue({
        response: { status: 400, data: { detail: "User already has permission for this file" } },
      });

      wrapper = createWrapper();
      await flushPromises();

      const input = wrapper.find(".invite-input");
      await input.setValue("existing@example.com");
      await wrapper.find(".invite-group").trigger("keydown.enter");
      await flushPromises();

      expect(wrapper.find(".invite-error").text()).toBe("This person already has access");
    });

    it("clears error on new input", async () => {
      wrapper = createWrapper();
      await flushPromises();

      await wrapper.find(".invite-group").trigger("keydown.enter");
      await flushPromises();
      expect(wrapper.find(".invite-error").exists()).toBe(true);

      const input = wrapper.find(".invite-input");
      await input.setValue("other@example.com");
      await flushPromises();
      expect(wrapper.find(".invite-error").exists()).toBe(false);
    });

    it("removes collaborator on remove button click", async () => {
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) {
          return Promise.resolve({
            data: [
              {
                permission_id: 10,
                user_id: 2,
                user_name: "Bob",
                user_email: "bob@example.com",
                role: "EDITOR",
              },
            ],
          });
        }
        return Promise.resolve({ data: {} });
      });
      mockApi.delete.mockResolvedValue({});

      wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.findAll(".person-row")).toHaveLength(2);

      await wrapper.find(".person-remove").trigger("click");
      await flushPromises();

      expect(mockApi.delete).toHaveBeenCalledWith("/files/123/permissions/10");
      expect(wrapper.findAll(".person-row")).toHaveLength(1);
    });
  });

  describe("publish section", () => {
    it("displays file title", () => {
      wrapper = createWrapper();
      const rows = wrapper.findAll(".row");
      const titleRow = rows[0];
      expect(titleRow.find(".value").text()).toBe("Quantum Effects in Neural Networks");
    });

    it("shows Untitled when title is missing", () => {
      wrapper = createWrapper({ file: { ...mockFile, title: "" } });
      const rows = wrapper.findAll(".row");
      const titleRow = rows[0];
      const emptyVal = titleRow.find(".value--empty");
      expect(emptyVal.exists()).toBe(true);
      expect(emptyVal.text()).toBe("Untitled");
    });

    it("fetches abstract on mount", () => {
      wrapper = createWrapper();
      expect(mockApi.get).toHaveBeenCalledWith("/files/123/content/abstract?handrails=false");
    });

    it("displays abstract after fetch", async () => {
      wrapper = createWrapper();
      await flushPromises();
      const rows = wrapper.findAll(".row");
      const abstractRow = rows[1];
      expect(abstractRow.find(".value--abstract").text()).toBe("We present a novel approach.");
    });

    it("shows empty state when abstract fetch fails", async () => {
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) return Promise.resolve({ data: [] });
        return Promise.reject(new Error("Network error"));
      });
      wrapper = createWrapper();
      await flushPromises();
      const rows = wrapper.findAll(".row");
      const abstractRow = rows[1];
      expect(abstractRow.find(".value--empty").text()).toBe("No abstract yet");
    });

    it("displays keywords from tags", () => {
      wrapper = createWrapper();
      const rows = wrapper.findAll(".row");
      const keywordsRow = rows[2];
      expect(keywordsRow.find(".value").text()).toBe("quantum, neural");
    });

    it("shows empty state when no tags", () => {
      wrapper = createWrapper({ file: { ...mockFile, tags: [] } });
      const rows = wrapper.findAll(".row");
      const keywordsRow = rows[2];
      expect(keywordsRow.find(".value--empty").text()).toBe("No keywords");
    });

    it("shows publish hint text", () => {
      wrapper = createWrapper();
      expect(wrapper.find(".publish-hint").text()).toContain("downloaded as HTML");
    });

    it("renders Download & Open Press button", () => {
      wrapper = createWrapper();
      const btn = wrapper.findComponent({ name: "Button" });
      expect(btn.exists()).toBe(true);
    });
  });

  describe("publish action", () => {
    it("downloads HTML and opens Press on click", async () => {
      const blobData = new Blob(["<html></html>"], { type: "text/html" });
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) return Promise.resolve({ data: [] });
        if (url.includes("/abstract"))
          return Promise.resolve({ data: { html: "<p>Abstract</p>" } });
        if (url.includes("/download")) return Promise.resolve({ data: blobData });
        return Promise.resolve({ data: {} });
      });

      const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});

      wrapper = createWrapper();
      await flushPromises();

      const btns = wrapper.findAllComponents({ name: "Button" });
      const downloadBtn = btns.find((b) => b.props("text") === "Download & Open Press");
      await downloadBtn.trigger("click");
      await flushPromises();

      expect(mockApi.get).toHaveBeenCalledWith("/files/123/download", {
        responseType: "blob",
      });

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining("scroll.press/upload"),
        "_blank"
      );

      openSpy.mockRestore();
    });

    it("includes title, abstract, and keywords in Press URL", async () => {
      const blobData = new Blob(["<html></html>"], { type: "text/html" });
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) return Promise.resolve({ data: [] });
        if (url.includes("/abstract"))
          return Promise.resolve({ data: { html: "<p>My abstract text</p>" } });
        if (url.includes("/download")) return Promise.resolve({ data: blobData });
        return Promise.resolve({ data: {} });
      });

      const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});

      wrapper = createWrapper();
      await flushPromises();

      const btns = wrapper.findAllComponents({ name: "Button" });
      const downloadBtn = btns.find((b) => b.props("text") === "Download & Open Press");
      await downloadBtn.trigger("click");
      await flushPromises();

      const url = openSpy.mock.calls[0][0];
      expect(url).toContain("title=Quantum");
      expect(url).toContain("abstract=My+abstract+text");
      expect(url).toContain("keywords=quantum");
      expect(url).toContain("source=studio");

      openSpy.mockRestore();
    });

    it("prevents double-click during download", async () => {
      let resolveDownload;
      mockApi.get.mockImplementation((url) => {
        if (url.includes("/permissions")) return Promise.resolve({ data: [] });
        if (url.includes("/abstract")) return Promise.resolve({ data: { html: "" } });
        if (url.includes("/download")) {
          return new Promise((resolve) => {
            resolveDownload = resolve;
          });
        }
        return Promise.resolve({ data: {} });
      });

      wrapper = createWrapper();
      await flushPromises();

      const btns = wrapper.findAllComponents({ name: "Button" });
      const downloadBtn = btns.find((b) => b.props("text") === "Download & Open Press");
      await downloadBtn.trigger("click");

      expect(downloadBtn.props("disabled")).toBe(true);

      resolveDownload?.({ data: new Blob() });
      await flushPromises();
    });
  });
});
