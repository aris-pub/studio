import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import FeedbackModal from "@/components/FeedbackModal.vue";

const mockPost = vi.fn();

const globalConfig = {
  provide: {
    api: { post: mockPost },
  },
  stubs: {
    Modal: {
      template: '<div class="modal-stub"><slot name="header"/><slot/></div>',
      emits: ["close"],
    },
    Icon: { template: '<span class="icon-stub"></span>', props: ["name"] },
    Button: {
      template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot/>{{ text }}</button>',
      props: ["kind", "text", "disabled", "icon"],
      emits: ["click"],
    },
  },
};

describe("FeedbackModal.vue", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("does not render when show is false", () => {
    const wrapper = mount(FeedbackModal, {
      props: { show: false },
      global: globalConfig,
    });
    expect(wrapper.find(".modal-stub").exists()).toBe(false);
  });

  it("renders when show is true", () => {
    const wrapper = mount(FeedbackModal, {
      props: { show: true },
      global: globalConfig,
    });
    expect(wrapper.find(".modal-stub").exists()).toBe(true);
    expect(wrapper.text()).toContain("Feedback");
  });

  it("submits feedback via API and emits close", async () => {
    mockPost.mockResolvedValueOnce({ data: { status: "ok" } });

    const wrapper = mount(FeedbackModal, {
      props: { show: true },
      global: globalConfig,
    });

    const textarea = wrapper.find("textarea");
    await textarea.setValue("Great work!");
    await nextTick();

    const buttons = wrapper.findAll("button");
    const sendBtn = buttons.find((b) => b.text().includes("Send feedback"));
    await sendBtn.trigger("click");

    await vi.waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/feedback", {
        message: "Great work!",
      });
      expect(wrapper.emitted("close")).toBeDefined();
    });
  });

  it("disables send button when message is empty", () => {
    const wrapper = mount(FeedbackModal, {
      props: { show: true },
      global: globalConfig,
    });

    const buttons = wrapper.findAll("button");
    const sendBtn = buttons.find((b) => b.text().includes("Send feedback"));
    expect(sendBtn.attributes("disabled")).toBeDefined();
  });

  it("emits close on cancel", async () => {
    const wrapper = mount(FeedbackModal, {
      props: { show: true },
      global: globalConfig,
    });

    const buttons = wrapper.findAll("button");
    const cancelBtn = buttons.find((b) => b.text().includes("Cancel"));
    await cancelBtn.trigger("click");

    expect(wrapper.emitted("close")).toBeDefined();
  });
});
