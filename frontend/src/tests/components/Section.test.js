import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import Section from "@/components/layout/Section.vue";

describe("Section.vue", () => {
  it("renders content slot inside .content", () => {
    const wrapper = mount(Section, {
      slots: { content: "<div>Section body</div>" },
    });

    const content = wrapper.get(".content");
    expect(content.html()).toContain("<div>Section body</div>");
  });

  it("renders title slot inside .title when provided", () => {
    const wrapper = mount(Section, {
      slots: { title: "<span>Heading</span>" },
    });

    const title = wrapper.get(".title");
    expect(title.classes()).toContain("text-h5");
    expect(title.html()).toContain("<span>Heading</span>");
  });

  it("renders footer slot inside .footer when provided", () => {
    const wrapper = mount(Section, {
      slots: { footer: "<footer>Foot</footer>" },
    });

    const footer = wrapper.get(".footer");
    expect(footer.html()).toContain("<footer>Foot</footer>");
  });

  it("applies danger class when provided via class attribute", () => {
    const wrapper = mount(Section, {
      attrs: { class: "danger" },
    });
    expect(wrapper.classes()).toContain("section");
    expect(wrapper.classes()).toContain("danger");
  });

  describe("headingTag prop", () => {
    it("renders title in a div by default", () => {
      const wrapper = mount(Section, {
        slots: { title: "Section Title" },
      });

      const title = wrapper.get(".title");
      expect(title.element.tagName).toBe("DIV");
    });

    it("renders title in an h2 when headingTag is h2", () => {
      const wrapper = mount(Section, {
        props: { headingTag: "h2" },
        slots: { title: "Section Title" },
      });

      const title = wrapper.get(".title");
      expect(title.element.tagName).toBe("H2");
    });

    it("renders title in an h3 when headingTag is h3", () => {
      const wrapper = mount(Section, {
        props: { headingTag: "h3" },
        slots: { title: "Section Title" },
      });

      const title = wrapper.get(".title");
      expect(title.element.tagName).toBe("H3");
    });

    it("preserves text-h5 class regardless of heading tag", () => {
      const wrapper = mount(Section, {
        props: { headingTag: "h2" },
        slots: { title: "Section Title" },
      });

      const title = wrapper.get(".title");
      expect(title.classes()).toContain("text-h5");
    });
  });
});
