import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, defineComponent } from "vue";
import { mount } from "@vue/test-utils";

import FeedbackIcon from "@/components/manuscript/FeedbackIcon.vue";

const ContextMenu = defineComponent({
  name: "ContextMenu",
  props: { placement: { type: String }, variant: { type: String } },
  methods: { toggle() {} },
  template: "<div><slot /><slot name='trigger' :toggle='toggle' /></div>",
});
const ContextMenuItem = defineComponent({
  name: "ContextMenuItem",
  props: { icon: String, caption: String, iconClass: String },
  emits: ["click"],
  template: '<button class="item" @click="$emit(\'click\')">{{ caption }}</button>',
});
const Separator = defineComponent({ name: "Separator", template: "<div class='sep'/>" });
const Icon = defineComponent({
  name: "Icon",
  props: { name: String },
  template: "<span />",
});

function mountIcon(file, { reactionActions, reactions } = {}) {
  return mount(FeedbackIcon, {
    global: {
      provide: {
        file,
        ...(reactionActions && { reactionActions }),
        ...(reactions && { reactions }),
      },
      stubs: { ContextMenu, ContextMenuItem, Separator, Icon },
    },
  });
}

describe("FeedbackIcon.vue", () => {
  let file;
  beforeEach(() => {
    file = ref({ icons: {} });
  });

  it("is hidden by default (opacity 0)", () => {
    const wrapper = mountIcon(file);
    const el = wrapper.get(".feedback");
    expect(el.classes()).not.toContain("visible");
  });

  it("selects a reaction and writes to file.icons", async () => {
    const wrapper = mountIcon(file);
    const items = wrapper.findAll(".item");
    expect(items.length).toBe(7);

    await items[0].trigger("click");
    const keys = Object.keys(file.value.icons);
    expect(keys).toHaveLength(1);
    expect(file.value.icons[keys[0]].class).toBe("bookmark");
  });

  it("becomes visible when a reaction is selected", async () => {
    const wrapper = mountIcon(file);
    await wrapper.findAll(".item")[0].trigger("click");
    expect(wrapper.get(".feedback").classes()).toContain("visible");
  });

  it("switching reactions replaces the previous one", async () => {
    const wrapper = mountIcon(file);
    const items = wrapper.findAll(".item");

    await items[0].trigger("click");
    expect(file.value.icons[Object.keys(file.value.icons)[0]].class).toBe("bookmark");

    await items[6].trigger("click");
    const keys = Object.keys(file.value.icons);
    expect(keys).toHaveLength(1);
    expect(file.value.icons[keys[0]].class).toBe("quote");
  });

  it("re-selecting the same reaction deselects it", async () => {
    const wrapper = mountIcon(file);
    const items = wrapper.findAll(".item");

    await items[2].trigger("click");
    expect(Object.keys(file.value.icons)).toHaveLength(1);

    await items[2].trigger("click");
    expect(Object.keys(file.value.icons)).toHaveLength(0);
    expect(wrapper.get(".feedback").classes()).not.toContain("visible");
  });

  it("shows Remove only when a reaction is selected", async () => {
    const wrapper = mountIcon(file);
    expect(wrapper.findAll(".sep")).toHaveLength(0);

    await wrapper.findAll(".item")[0].trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".sep")).toHaveLength(1);
  });

  it("cleans up file.icons on unmount", async () => {
    const wrapper = mountIcon(file);
    await wrapper.findAll(".item")[0].trigger("click");
    expect(Object.keys(file.value.icons)).toHaveLength(1);

    wrapper.unmount();
    expect(Object.keys(file.value.icons)).toHaveLength(0);
  });

  it("calls upsertReaction when data-nodeid is on the .hr element itself", async () => {
    const upsertReaction = vi.fn();
    const deleteReaction = vi.fn();

    const container = document.createElement("div");
    container.innerHTML = '<div class="hr" data-nodeid="para-7"><div class="hr-info"></div></div>';
    document.body.appendChild(container);
    const hrInfo = container.querySelector(".hr-info");

    const wrapper = mount(FeedbackIcon, {
      attachTo: hrInfo,
      global: {
        provide: {
          file,
          reactionActions: { upsertReaction, deleteReaction },
          reactions: ref([]),
        },
        stubs: { ContextMenu, ContextMenuItem, Separator, Icon },
      },
    });

    await wrapper.findAll(".item")[0].trigger("click");
    expect(upsertReaction).toHaveBeenCalledWith("para-7", "bookmark");

    container.remove();
    wrapper.unmount();
  });

  it("calls deleteReaction when deselecting a reaction", async () => {
    const upsertReaction = vi.fn();
    const deleteReaction = vi.fn();

    const container = document.createElement("div");
    container.innerHTML = '<div class="hr" data-nodeid="para-8"><div class="hr-info"></div></div>';
    document.body.appendChild(container);
    const hrInfo = container.querySelector(".hr-info");

    const wrapper = mount(FeedbackIcon, {
      attachTo: hrInfo,
      global: {
        provide: {
          file,
          reactionActions: { upsertReaction, deleteReaction },
          reactions: ref([]),
        },
        stubs: { ContextMenu, ContextMenuItem, Separator, Icon },
      },
    });

    await wrapper.findAll(".item")[0].trigger("click");
    expect(upsertReaction).toHaveBeenCalledWith("para-8", "bookmark");

    await wrapper.findAll(".item")[0].trigger("click");
    expect(deleteReaction).toHaveBeenCalledWith("para-8");

    container.remove();
    wrapper.unmount();
  });

  it("trigger button has tabindex=-1 (regression: j/k navigation stops on reaction buttons)", () => {
    const file = ref({ id: 1 });
    const wrapper = mountIcon(file);
    const btn = wrapper.find(".trigger-btn");
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("tabindex")).toBe("-1");
    wrapper.unmount();
  });
});
