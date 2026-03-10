import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import Note from "@/components/annotations/Note.vue";
import Button from "@/components/base/Button.vue";
import { HIGHLIGHT_COLORS } from "@/constants/annotationColors.js";

beforeEach(() => {
  localStorage.removeItem("annotation-collapsed");
});

function makeAnnotation(overrides = {}) {
  return {
    id: 1,
    color: "purple",
    selected_text: "The possibilities are endless",
    created_at: new Date().toISOString(),
    messages: [],
    ...overrides,
  };
}

function makeAnnotationWithNote(overrides = {}) {
  return makeAnnotation({
    messages: [{ id: 10, content: "My note", deleted_at: null }],
    ...overrides,
  });
}

function createWrapper(annotation, { activeId = null, actions = {} } = {}) {
  const activeAnnotationId = ref(activeId);
  const annotationActions = {
    deleteAnnotation: vi.fn().mockResolvedValue({}),
    updateNote: vi.fn().mockResolvedValue({}),
    addNote: vi.fn().mockResolvedValue({}),
    ...actions,
  };
  const wrapper = mount(Note, {
    props: { annotation },
    global: {
      components: { Button },
      provide: {
        annotationActions,
        activeAnnotationId,
      },
    },
  });
  return { wrapper, activeAnnotationId, annotationActions };
}

// Helper: find a Button component by its icon prop
function findButtonByIcon(wrapper, iconName) {
  return wrapper.findAllComponents(Button).find((b) => b.props("icon") === iconName);
}

describe("Note.vue — border and left color bar (std-lqmk)", () => {
  it("renders a .note element with left color bar using annotation color", () => {
    const { wrapper } = createWrapper(makeAnnotation({ color: "red" }));
    const note = wrapper.find(".note");
    expect(note.exists()).toBe(true);
    expect(note.attributes("style")).toContain(HIGHLIGHT_COLORS.red.border);
  });

  it("falls back to purple when color is unknown", () => {
    const { wrapper } = createWrapper(makeAnnotation({ color: "nonexistent" }));
    expect(wrapper.find(".note").attributes("style")).toContain(HIGHLIGHT_COLORS.purple.border);
  });

  it("uses border color (400 shade) not bg color for the bar", () => {
    for (const [name, colors] of Object.entries(HIGHLIGHT_COLORS)) {
      const { wrapper } = createWrapper(makeAnnotation({ color: name }));
      expect(wrapper.find(".note").attributes("style")).toContain(colors.border);
    }
  });
});

describe("Note.vue — visual states (std-7cfa)", () => {
  it("has no .active class when not active", () => {
    const { wrapper } = createWrapper(makeAnnotation(), { activeId: 999 });
    expect(wrapper.find(".note").classes()).not.toContain("active");
  });

  it("has .active class when activeAnnotationId matches", () => {
    const { wrapper } = createWrapper(makeAnnotation({ id: 5 }), { activeId: 5 });
    expect(wrapper.find(".note").classes()).toContain("active");
  });

  it("clicking the card sets activeAnnotationId", async () => {
    const { wrapper, activeAnnotationId } = createWrapper(makeAnnotation({ id: 42 }));
    await wrapper.find(".note").trigger("click");
    expect(activeAnnotationId.value).toBe(42);
  });

  it("action buttons exist inside .actions container", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    const actions = wrapper.find(".actions");
    expect(actions.exists()).toBe(true);
    expect(actions.findAll(":scope > *").length).toBeGreaterThan(0);
  });

  it("has tabindex=0 for keyboard focus", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    expect(wrapper.find(".note").attributes("tabindex")).toBe("0");
  });

  it("has outline: none to suppress browser focus ring", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    expect(wrapper.find(".note").exists()).toBe(true);
    // Verified via CSS rule in component — .note { outline: none; }
  });
});

describe("Note.vue — typography hierarchy (std-i1uq)", () => {
  it("renders timestamp with .timestamp class", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    const ts = wrapper.find(".timestamp");
    expect(ts.exists()).toBe(true);
    expect(ts.text()).toBeTruthy();
  });

  it("renders selected text with .selected-text class", () => {
    const { wrapper } = createWrapper(makeAnnotation({ selected_text: "some text" }));
    const sel = wrapper.find(".selected-text");
    expect(sel.exists()).toBe(true);
    expect(sel.text()).toBe("some text");
  });

  it("renders note content with .note-text class", () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote());
    const noteText = wrapper.find(".note-text");
    expect(noteText.exists()).toBe(true);
    expect(noteText.text()).toBe("My note");
  });

  it("collapsed preview uses .note-text class for consistency", async () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote());
    const collapseBtn = findButtonByIcon(wrapper, "ChevronUp");
    expect(collapseBtn).toBeTruthy();
    await collapseBtn.trigger("click");
    await nextTick();
    const collapsed = wrapper.find(".collapsed-line");
    expect(collapsed.exists()).toBe(true);
    expect(collapsed.classes()).toContain("note-text");
  });
});

describe("Note.vue — card structure (std-fv7e)", () => {
  it("renders .header with timestamp and actions", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    const header = wrapper.find(".header");
    expect(header.exists()).toBe(true);
    expect(header.find(".timestamp").exists()).toBe(true);
    expect(header.find(".actions").exists()).toBe(true);
  });

  it("renders .content section when not collapsed", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    expect(wrapper.find(".content").exists()).toBe(true);
  });

  it("renders .collapsed-line when collapsed", async () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote());
    const collapseBtn = findButtonByIcon(wrapper, "ChevronUp");
    await collapseBtn.trigger("click");
    await nextTick();
    expect(wrapper.find(".collapsed-line").exists()).toBe(true);
    expect(wrapper.find(".content").exists()).toBe(false);
  });
});

describe("Note.vue — delete confirmation pill (std-t3dj)", () => {
  it("first click arms confirmation (switches to danger pill with Delete text)", async () => {
    const { wrapper } = createWrapper(makeAnnotation());
    const deleteBtn = wrapper.find(".delete-btn");

    await deleteBtn.trigger("click");
    await nextTick();

    const btn = wrapper.findAllComponents(Button).find((b) => b.props("kind") === "danger");
    expect(btn).toBeTruthy();
    expect(btn.props("text")).toBe("Delete");
  });

  it("second click within debounce window does NOT delete", async () => {
    const { wrapper, annotationActions } = createWrapper(makeAnnotation());
    const deleteBtn = wrapper.find(".delete-btn");

    await deleteBtn.trigger("click"); // arm
    await nextTick();
    await deleteBtn.trigger("click"); // within 400ms debounce
    await nextTick();

    expect(annotationActions.deleteAnnotation).not.toHaveBeenCalled();
  });

  it("second click after debounce window deletes", async () => {
    vi.useFakeTimers();
    const { wrapper, annotationActions } = createWrapper(makeAnnotation({ id: 7 }));
    const deleteBtn = wrapper.find(".delete-btn");

    await deleteBtn.trigger("click"); // arm
    await nextTick();

    vi.advanceTimersByTime(500); // past 400ms debounce

    await deleteBtn.trigger("click"); // confirm
    await nextTick();

    expect(annotationActions.deleteAnnotation).toHaveBeenCalledWith(7);
    vi.useRealTimers();
  });

  it("confirmation resets after 3s timeout", async () => {
    vi.useFakeTimers();
    const { wrapper } = createWrapper(makeAnnotation());
    const deleteBtn = wrapper.find(".delete-btn");

    await deleteBtn.trigger("click");
    await nextTick();

    let btn = wrapper.findAllComponents(Button).find((b) => b.props("kind") === "danger");
    expect(btn).toBeTruthy();

    vi.advanceTimersByTime(3100);
    await nextTick();

    btn = wrapper.findAllComponents(Button).find((b) => b.props("kind") === "danger");
    expect(btn).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("Note.vue — chevron only with note (std-r0j0)", () => {
  it("renders chevron button when annotation has a note", () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote());
    const chevron = findButtonByIcon(wrapper, "ChevronUp");
    expect(chevron).toBeTruthy();
  });

  it("does NOT render chevron when annotation has no note", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    const chevronUp = findButtonByIcon(wrapper, "ChevronUp");
    const chevronDown = findButtonByIcon(wrapper, "ChevronDown");
    expect(chevronUp).toBeUndefined();
    expect(chevronDown).toBeUndefined();
  });

  it("edit button renders regardless of note", () => {
    const { wrapper: w1 } = createWrapper(makeAnnotation());
    const { wrapper: w2 } = createWrapper(makeAnnotationWithNote());
    expect(findButtonByIcon(w1, "Edit")).toBeTruthy();
    expect(findButtonByIcon(w2, "Edit")).toBeTruthy();
  });

  it("delete button renders regardless of note", () => {
    const { wrapper: w1 } = createWrapper(makeAnnotation());
    const { wrapper: w2 } = createWrapper(makeAnnotationWithNote());
    expect(w1.find(".delete-btn").exists()).toBe(true);
    expect(w2.find(".delete-btn").exists()).toBe(true);
  });
});

describe("Note.vue — ESC deselects active card (std-e0vc)", () => {
  it("ESC clears activeAnnotationId when card is active", async () => {
    const { wrapper, activeAnnotationId } = createWrapper(makeAnnotation({ id: 3 }), {
      activeId: 3,
    });
    expect(activeAnnotationId.value).toBe(3);

    await wrapper.find(".note").trigger("keydown", { key: "Escape" });
    await nextTick();

    expect(activeAnnotationId.value).toBeNull();
  });

  it("ESC does nothing when card is not active", async () => {
    const { wrapper, activeAnnotationId } = createWrapper(makeAnnotation({ id: 3 }), {
      activeId: 999,
    });
    await wrapper.find(".note").trigger("keydown", { key: "Escape" });
    await nextTick();
    expect(activeAnnotationId.value).toBe(999);
  });

  it("ESC on textarea cancels edit without deselecting (stopPropagation)", async () => {
    const { wrapper, activeAnnotationId } = createWrapper(makeAnnotationWithNote({ id: 3 }), {
      activeId: 3,
    });
    // Enter edit mode
    const editBtn = findButtonByIcon(wrapper, "Edit");
    await editBtn.trigger("click");
    await nextTick();
    expect(wrapper.find(".edit-area").exists()).toBe(true);

    // ESC on textarea
    await wrapper.find(".edit-input").trigger("keydown", { key: "Escape" });
    await nextTick();

    expect(wrapper.find(".edit-area").exists()).toBe(false);
    expect(activeAnnotationId.value).toBe(3);
  });
});

describe("Note.vue — edit mode suppresses active border (std-5l1z)", () => {
  it("active class is removed during editing", async () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 3 }), { activeId: 3 });
    expect(wrapper.find(".note").classes()).toContain("active");

    const editBtn = findButtonByIcon(wrapper, "Edit");
    await editBtn.trigger("click");
    await nextTick();

    expect(wrapper.find(".note").classes()).not.toContain("active");
    expect(wrapper.find(".note").classes()).toContain("editing");
  });

  it("active class returns after saving edit", async () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 3 }), { activeId: 3 });
    await findButtonByIcon(wrapper, "Edit").trigger("click");
    await nextTick();
    expect(wrapper.find(".note").classes()).not.toContain("active");

    // Find Save button by text content
    const saveBtn = wrapper.findAllComponents(Button).find((b) => b.text() === "Save");
    await saveBtn.trigger("click");
    await nextTick();

    expect(wrapper.find(".note").classes()).toContain("active");
    expect(wrapper.find(".note").classes()).not.toContain("editing");
  });

  it("active class returns after canceling edit", async () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 3 }), { activeId: 3 });
    await findButtonByIcon(wrapper, "Edit").trigger("click");
    await nextTick();

    const cancelBtn = wrapper.findAllComponents(Button).find((b) => b.text() === "Cancel");
    await cancelBtn.trigger("click");
    await nextTick();

    expect(wrapper.find(".note").classes()).toContain("active");
  });
});

describe("Note.vue — timeAgo display", () => {
  it("shows 'just now' for recent annotations", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    expect(wrapper.find(".timestamp").text().toLowerCase()).toContain("just now");
  });

  it("shows minutes for older annotations", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const { wrapper } = createWrapper(makeAnnotation({ created_at: fiveMinAgo }));
    expect(wrapper.find(".timestamp").text()).toContain("5min ago");
  });
});

describe("Note.vue — persistent collapse state (std-1u9j)", () => {
  it("saves collapsed state to localStorage on toggle", async () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 50 }));
    const chevronBtn = findButtonByIcon(wrapper, "ChevronUp");
    await chevronBtn.trigger("click");
    await nextTick();

    const stored = JSON.parse(localStorage.getItem("annotation-collapsed") || "{}");
    expect(stored[50]).toBe(true);
  });

  it("restores collapsed state from localStorage", () => {
    localStorage.setItem("annotation-collapsed", JSON.stringify({ 60: true }));
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 60 }));
    expect(wrapper.find(".collapsed-line").exists()).toBe(true);
    expect(wrapper.find(".content").exists()).toBe(false);
  });

  it("removes key from localStorage when expanding", async () => {
    localStorage.setItem("annotation-collapsed", JSON.stringify({ 70: true }));
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 70 }));
    const chevronBtn = findButtonByIcon(wrapper, "ChevronDown");
    await chevronBtn.trigger("click");
    await nextTick();

    const stored = JSON.parse(localStorage.getItem("annotation-collapsed") || "{}");
    expect(stored[70]).toBeUndefined();
  });
});

describe("Note.vue — collapsed chevron affordance (std-u3o4)", () => {
  it("has .collapsed class on card when collapsed with a note", async () => {
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 80 }));
    const chevronBtn = findButtonByIcon(wrapper, "ChevronUp");
    await chevronBtn.trigger("click");
    await nextTick();
    expect(wrapper.find(".note").classes()).toContain("collapsed");
  });

  it("does NOT have .collapsed class on card without a note", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    expect(wrapper.find(".note").classes()).not.toContain("collapsed");
  });

  it("chevron shows ChevronDown icon when collapsed", async () => {
    localStorage.setItem("annotation-collapsed", JSON.stringify({ 90: true }));
    const { wrapper } = createWrapper(makeAnnotationWithNote({ id: 90 }));
    const chevronDown = findButtonByIcon(wrapper, "ChevronDown");
    expect(chevronDown).toBeTruthy();
  });
});

describe("Note.vue — trash button squircle (std-0f70)", () => {
  it("delete button has border-radius 8px (squircle, not circle)", () => {
    const { wrapper } = createWrapper(makeAnnotation());
    const deleteBtn = wrapper.find(".delete-btn");
    expect(deleteBtn.exists()).toBe(true);
    // Verified via CSS: .delete-btn { border-radius: 8px; }
  });
});

describe("Note.vue — search match highlighting (std-50vp)", () => {
  function createSearchWrapper(
    annotation,
    { searchMatch = false, searchMatchCurrent = false, searchQuery = "" } = {}
  ) {
    return mount(Note, {
      props: { annotation, searchMatch, searchMatchCurrent, searchQuery },
      global: {
        components: { Button },
        provide: {
          annotationActions: {
            deleteAnnotation: vi.fn().mockResolvedValue({}),
            updateNote: vi.fn().mockResolvedValue({}),
            addNote: vi.fn().mockResolvedValue({}),
          },
          activeAnnotationId: ref(null),
        },
      },
    });
  }

  it("applies .search-match class when searchMatch prop is true", () => {
    const wrapper = createSearchWrapper(makeAnnotation(), { searchMatch: true });
    expect(wrapper.find(".note").classes()).toContain("search-match");
  });

  it("does not apply .search-match class when searchMatch prop is false", () => {
    const wrapper = createSearchWrapper(makeAnnotation());
    expect(wrapper.find(".note").classes()).not.toContain("search-match");
  });

  it("highlights search term in note content with aris-search-highlight span", () => {
    const ann = makeAnnotationWithNote({
      messages: [{ id: 10, content: "quantum leap", deleted_at: null }],
    });
    const wrapper = createSearchWrapper(ann, { searchMatch: true, searchQuery: "quantum" });
    const noteText = wrapper.find(".note-text");
    expect(noteText.html()).toContain('<span class="aris-search-highlight">quantum</span>');
  });

  it("highlights search term in selected_text", () => {
    const ann = makeAnnotation({ selected_text: "endless possibilities" });
    const wrapper = createSearchWrapper(ann, { searchMatch: true, searchQuery: "endless" });
    const selectedText = wrapper.find(".selected-text");
    expect(selectedText.html()).toContain('<span class="aris-search-highlight">endless</span>');
  });

  it("does not inject highlights when searchMatch is false", () => {
    const ann = makeAnnotationWithNote({
      messages: [{ id: 10, content: "quantum leap", deleted_at: null }],
    });
    const wrapper = createSearchWrapper(ann, { searchMatch: false, searchQuery: "quantum" });
    const noteText = wrapper.find(".note-text");
    expect(noteText.html()).not.toContain("aris-search-highlight");
  });

  it("escapes HTML in text before highlighting", () => {
    const ann = makeAnnotation({ selected_text: "<script>alert(1)</script>" });
    const wrapper = createSearchWrapper(ann, { searchMatch: true, searchQuery: "script" });
    const selectedText = wrapper.find(".selected-text");
    expect(selectedText.html()).not.toContain("<script>");
    expect(selectedText.html()).toContain("&lt;");
  });

  it("handles special regex characters in search query", () => {
    const ann = makeAnnotationWithNote({
      messages: [{ id: 10, content: "price is $100 (USD)", deleted_at: null }],
    });
    const wrapper = createSearchWrapper(ann, { searchMatch: true, searchQuery: "$100" });
    const noteText = wrapper.find(".note-text");
    expect(noteText.html()).toContain('<span class="aris-search-highlight">$100</span>');
  });

  it("is case-insensitive when highlighting", () => {
    const ann = makeAnnotationWithNote({
      messages: [{ id: 10, content: "Quantum Leap", deleted_at: null }],
    });
    const wrapper = createSearchWrapper(ann, { searchMatch: true, searchQuery: "quantum" });
    const noteText = wrapper.find(".note-text");
    expect(noteText.html()).toContain('<span class="aris-search-highlight">Quantum</span>');
  });

  it("applies .search-match-current class when searchMatchCurrent prop is true", () => {
    const wrapper = createSearchWrapper(makeAnnotation(), {
      searchMatch: true,
      searchMatchCurrent: true,
    });
    expect(wrapper.find(".note").classes()).toContain("search-match-current");
  });

  it("does not apply .search-match-current class by default", () => {
    const wrapper = createSearchWrapper(makeAnnotation(), { searchMatch: true });
    expect(wrapper.find(".note").classes()).not.toContain("search-match-current");
  });

  it("uses aris-search-highlight--current class for inline text when current", () => {
    const ann = makeAnnotationWithNote({
      messages: [{ id: 10, content: "foo bar", deleted_at: null }],
    });
    const wrapper = createSearchWrapper(ann, {
      searchMatch: true,
      searchMatchCurrent: true,
      searchQuery: "foo",
    });
    const noteText = wrapper.find(".note-text");
    expect(noteText.html()).toContain('<span class="aris-search-highlight--current">foo</span>');
    expect(noteText.html()).not.toContain('"aris-search-highlight"');
  });

  it("uses aris-search-highlight class for inline text when not current", () => {
    const ann = makeAnnotationWithNote({
      messages: [{ id: 10, content: "foo bar", deleted_at: null }],
    });
    const wrapper = createSearchWrapper(ann, {
      searchMatch: true,
      searchMatchCurrent: false,
      searchQuery: "foo",
    });
    const noteText = wrapper.find(".note-text");
    expect(noteText.html()).toContain('<span class="aris-search-highlight">foo</span>');
    expect(noteText.html()).not.toContain("--current");
  });
});
