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
};

const mockUser = {
  value: {
    id: 1,
    name: "Ada Lovelace",
    email: "ada@example.com",
  },
};

const mockFile = {
  id: 123,
  owner_id: 1,
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
    mockApi.get.mockResolvedValue({ data: { html: "<p>We present a novel approach.</p>" } });
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
              '<button class="button-stub" @click="$emit(\'click\')" :disabled="disabled" />',
            props: ["kind", "size", "icon", "text", "disabled"],
            emits: ["click"],
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
    it("displays owner initials in avatar", () => {
      wrapper = createWrapper();
      const avatar = wrapper.find(".person-avatar");
      expect(avatar.text()).toBe("AL");
    });

    it("displays owner name", () => {
      wrapper = createWrapper();
      const name = wrapper.find(".person-name");
      expect(name.text()).toBe("Ada Lovelace");
    });

    it("displays Owner role badge", () => {
      wrapper = createWrapper();
      const role = wrapper.find(".person-role");
      expect(role.text()).toBe("Owner");
    });

    it("falls back to email when name is missing", () => {
      wrapper = createWrapper({
        user: { value: { id: 1, email: "ada@example.com" } },
      });
      const name = wrapper.find(".person-name");
      expect(name.text()).toBe("ada@example.com");
    });

    it("shows two-letter initials from email when name is missing", () => {
      wrapper = createWrapper({
        user: { value: { id: 1, email: "ada@example.com" } },
      });
      const avatar = wrapper.find(".person-avatar");
      expect(avatar.text()).toBe("AD");
    });

    it("renders disabled invite input", () => {
      wrapper = createWrapper();
      const input = wrapper.find(".invite-input");
      expect(input.exists()).toBe(true);
      expect(input.attributes("disabled")).toBeDefined();
      expect(input.attributes("placeholder")).toContain("coming soon");
    });

    it("shows notification system hint", () => {
      wrapper = createWrapper();
      const hint = wrapper.find(".invite-hint");
      expect(hint.text()).toContain("notification system");
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
      mockApi.get.mockRejectedValue(new Error("Network error"));
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
      mockApi.get
        .mockResolvedValueOnce({ data: { html: "<p>Abstract</p>" } })
        .mockResolvedValueOnce({ data: blobData });

      const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});

      wrapper = createWrapper();
      await flushPromises();

      const btn = wrapper.findComponent({ name: "Button" });
      await btn.trigger("click");
      await flushPromises();

      // Should have called download endpoint
      expect(mockApi.get).toHaveBeenCalledWith("/files/123/download", {
        responseType: "blob",
      });

      // Should have opened Press in new tab
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining("scroll.press/upload"),
        "_blank"
      );

      openSpy.mockRestore();
    });

    it("includes title, abstract, and keywords in Press URL", async () => {
      const blobData = new Blob(["<html></html>"], { type: "text/html" });
      mockApi.get
        .mockResolvedValueOnce({ data: { html: "<p>My abstract text</p>" } })
        .mockResolvedValueOnce({ data: blobData });

      const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});

      wrapper = createWrapper();
      await flushPromises();

      const btn = wrapper.findComponent({ name: "Button" });
      await btn.trigger("click");
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
      mockApi.get.mockResolvedValueOnce({ data: { html: "" } }).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDownload = resolve;
          })
      );

      wrapper = createWrapper();
      await flushPromises();

      const btn = wrapper.findComponent({ name: "Button" });
      await btn.trigger("click");

      // Button should be disabled during download
      expect(btn.props("disabled")).toBe(true);

      // Resolve to cleanup
      resolveDownload?.({ data: new Blob() });
      await flushPromises();
    });
  });
});
