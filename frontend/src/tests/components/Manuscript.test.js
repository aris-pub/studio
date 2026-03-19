import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { shallowMount } from "@vue/test-utils";

import Manuscript from "@/components/manuscript/Manuscript.vue";

describe("Manuscript.vue", () => {
  it("renders basic HTML string", async () => {
    const html = "<h1>Title</h1><p>Paragraph</p>";
    const wrapper = shallowMount(Manuscript, {
      props: { htmlString: html },
      global: {
        stubs: ["FeedbackIcon"],
      },
    });
    await nextTick();
    expect(wrapper.html()).toContain("<h1>Title</h1>");
    expect(wrapper.html()).toContain("<p>Paragraph</p>");
  });

  it("applies style attributes to elements", async () => {
    const html = '<div style="color: red; font-size: 12px"></div>';
    const wrapper = shallowMount(Manuscript, {
      props: { htmlString: html },
      global: {
        stubs: ["FeedbackIcon"],
      },
    });
    await nextTick();
    const div = wrapper.element.querySelector("div");
    expect(div.style.color).toBe("red");
    expect(div.style.fontSize).toBe("12px");
  });

  it("renders FeedbackIcon for elements with hr-info class", async () => {
    const html = '<div class="hr-info">Info</div>';
    const wrapper = shallowMount(Manuscript, {
      props: { htmlString: html },
      global: {
        stubs: ["FeedbackIcon"],
      },
    });
    await nextTick();
    expect(wrapper.html()).toContain('<div class="hr-info">Info<feedback-icon-stub');
    expect(wrapper.find("feedback-icon-stub").exists()).toBe(true);
  });

  it("preserves SVG attributes (regression: attrs=[object Object])", async () => {
    const html = '<svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
    const wrapper = shallowMount(Manuscript, {
      props: { htmlString: html },
      global: {
        stubs: ["FeedbackIcon"],
      },
    });
    await nextTick();
    const svg = wrapper.element.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("width")).toBe("100");
    expect(svg.getAttribute("height")).toBe("100");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(svg.getAttribute("attrs")).toBeNull();

    const circle = wrapper.element.querySelector("circle");
    expect(circle).toBeTruthy();
    expect(circle.getAttribute("cx")).toBe("50");
    expect(circle.getAttribute("fill")).toBe("red");
  });

  it("preserves img src attribute (regression: attrs=[object Object])", async () => {
    const html = '<img src="https://example.com/photo.png" alt="test photo" width="200">';
    const wrapper = shallowMount(Manuscript, {
      props: { htmlString: html },
      global: {
        stubs: ["FeedbackIcon"],
      },
    });
    await nextTick();
    const img = wrapper.element.querySelector("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("https://example.com/photo.png");
    expect(img.getAttribute("alt")).toBe("test photo");
    expect(img.getAttribute("width")).toBe("200");
    expect(img.getAttribute("attrs")).toBeNull();
  });

  it("preserves aria and data attributes (regression: attrs=[object Object])", async () => {
    const html = '<button data-action="submit" aria-label="Submit form" role="button">Go</button>';
    const wrapper = shallowMount(Manuscript, {
      props: { htmlString: html },
      global: {
        stubs: ["FeedbackIcon"],
      },
    });
    await nextTick();
    const btn = wrapper.element.querySelector("button");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("data-action")).toBe("submit");
    expect(btn.getAttribute("aria-label")).toBe("Submit form");
    expect(btn.getAttribute("role")).toBe("button");
    expect(btn.getAttribute("attrs")).toBeNull();
  });
});
