import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";

const pushMock = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => ({ params: {} }),
}));

describe("ModalUploadFile.vue", () => {
  let api, user, fileStore, useClosableStub;

  beforeEach(() => {
    vi.resetModules();
    pushMock.mockClear();

    api = {
      post: vi.fn().mockResolvedValue({ data: { id: 42 } }),
    };
    user = ref({ id: 1, name: "Test", email: "test@example.com" });
    fileStore = ref({ loadFiles: vi.fn().mockResolvedValue() });

    useClosableStub = vi.fn(() => ({}));
    vi.doMock("@/composables/useClosable.js", () => ({
      default: useClosableStub,
    }));
  });

  const createWrapper = async () => {
    const { default: ModalUploadFile } = await import("@/views/home/ModalUploadFile.vue");
    return mount(ModalUploadFile, {
      global: {
        provide: { api, user, fileStore },
        stubs: {
          Modal: { template: '<div><slot name="header"/><slot/></div>' },
          Button: {
            template:
              '<button :disabled="disabled" v-bind="$attrs" @click="$emit(\'click\')">{{ text }}</button>',
            props: ["text", "kind", "icon", "disabled"],
          },
          ButtonClose: { template: "<button />" },
        },
      },
    });
  };

  const selectFile = async (wrapper, name, content = "# Hello") => {
    const input = wrapper.find('[data-testid="file-upload-input"]');
    const file = new File([content], name, { type: "text/plain" });
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    await nextTick();
    return file;
  };

  // ─── Format detection ───────────────────────────────────────────────────

  it("shows format hint for markdown file", async () => {
    const wrapper = await createWrapper();
    await selectFile(wrapper, "paper.md");

    const hint = wrapper.find('[data-testid="format-hint"]');
    expect(hint.exists()).toBe(true);
    expect(hint.text()).toBe("Markdown → RSM");
  });

  it("shows format hint for LaTeX file", async () => {
    const wrapper = await createWrapper();
    await selectFile(wrapper, "thesis.tex");

    const hint = wrapper.find('[data-testid="format-hint"]');
    expect(hint.text()).toBe("LaTeX → RSM");
  });

  it("shows format hint for DOCX file", async () => {
    const wrapper = await createWrapper();
    await selectFile(wrapper, "draft.docx");

    const hint = wrapper.find('[data-testid="format-hint"]');
    expect(hint.text()).toBe("Word (DOCX) → RSM");
  });

  it("shows native hint for RSM file", async () => {
    const wrapper = await createWrapper();
    await selectFile(wrapper, "paper.rsm");

    const hint = wrapper.find('[data-testid="format-hint"]');
    expect(hint.text()).toBe("RSM (native)");
  });

  // ─── API routing ────────────────────────────────────────────────────────

  it("uses /files/import for markdown files", async () => {
    const wrapper = await createWrapper();
    await selectFile(wrapper, "paper.md", "# Introduction\n\nHello.\n");

    await wrapper.find('[data-testid="file-upload-submit"]').trigger("click");
    await nextTick();

    expect(api.post).toHaveBeenCalledWith(
      "/files/import",
      expect.any(FormData),
      expect.objectContaining({
        headers: { "Content-Type": "multipart/form-data" },
      })
    );
  });

  it("uses /files/ for RSM files", async () => {
    const wrapper = await createWrapper();

    // Create a File with a mocked text() that resolves immediately
    const input = wrapper.find('[data-testid="file-upload-input"]');
    const file = new File(["# My Paper\n"], "paper.rsm", { type: "text/plain" });
    file.text = vi.fn().mockResolvedValue("# My Paper\n");
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    await nextTick();

    await wrapper.find('[data-testid="file-upload-submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(api.post).toHaveBeenCalledWith("/files/", {
      source: "# My Paper\n",
      owner_id: 1,
      title: "",
      abstract: "",
    });
  });

  // ─── Navigation ─────────────────────────────────────────────────────────

  it("navigates to /file/{id} after successful upload", async () => {
    const wrapper = await createWrapper();
    await selectFile(wrapper, "paper.md");

    await wrapper.find('[data-testid="file-upload-submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(pushMock).toHaveBeenCalledWith("/file/42");
  });

  it("emits close after successful upload", async () => {
    const wrapper = await createWrapper();
    await selectFile(wrapper, "paper.md");

    await wrapper.find('[data-testid="file-upload-submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(wrapper.emitted("close")).toBeDefined();
  });

  // ─── Error handling ─────────────────────────────────────────────────────

  it("shows error on upload failure", async () => {
    api.post = vi.fn().mockRejectedValue({
      response: { data: { detail: "Unsupported format" } },
    });

    const wrapper = await createWrapper();
    await selectFile(wrapper, "paper.md");

    await wrapper.find('[data-testid="file-upload-submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    const errorEl = wrapper.find('[data-testid="upload-error"]');
    expect(errorEl.exists()).toBe(true);
    expect(errorEl.text()).toBe("Unsupported format");
  });

  it("does not navigate on upload failure", async () => {
    api.post = vi.fn().mockRejectedValue({
      response: { data: { detail: "fail" } },
    });

    const wrapper = await createWrapper();
    await selectFile(wrapper, "paper.md");

    await wrapper.find('[data-testid="file-upload-submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(pushMock).not.toHaveBeenCalled();
  });

  // ─── Upload button state ───────────────────────────────────────────────

  it("disables upload button when no file selected", async () => {
    const wrapper = await createWrapper();
    const btn = wrapper.find('[data-testid="file-upload-submit"]');
    expect(btn.element.disabled).toBe(true);
  });
});
