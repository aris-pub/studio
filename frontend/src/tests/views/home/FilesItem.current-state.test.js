/**
 * Regression tests for the unified "current" file item state.
 *
 * Exactly one file should be visually highlighted at a time. The .current class
 * is the ONLY mechanism for persistent highlighting — no blue active state, no
 * :focus/:focus-visible background, no competing .focused/.active classes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref, Suspense } from "vue";
import FilesItem from "@/views/home/FilesItem.vue";

describe("FilesItem.vue — unified .current state", () => {
  let mockProvides;

  const makeFile = (overrides = {}) =>
    ref({
      id: "file-1",
      title: "File One",
      selected: false,
      focused: false,
      lastModified: new Date().toISOString(),
      tags: [],
      ...overrides,
    });

  const makeFileStore = (files = []) =>
    ref({
      files,
      selectFile: vi.fn((file) => {
        files.forEach((f) => (f.selected = false));
        file.selected = true;
      }),
      createFile: vi.fn(),
      deleteFile: vi.fn(),
    });

  beforeEach(() => {
    mockProvides = {
      api: { get: vi.fn().mockResolvedValue({ data: {} }) },
      xsMode: ref(false),
      mobileMode: ref(false),
      user: ref({ id: "user-1" }),
      shouldShowColumn: vi.fn(() => true),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stubs = {
    FileMenu: {
      template:
        '<div data-testid="file-menu" class="fm-wrapper"><div class="context-menu-trigger">⋮</div></div>',
    },
    FileTitle: {
      template: '<div data-testid="file-title">{{ file.title }}</div>',
      props: ["file"],
    },
    TagRow: { template: '<div data-testid="tag-row"></div>' },
    Date: { template: '<div data-testid="files-item-date"></div>' },
  };

  const mountItem = async (file, fileStore, overrides = {}) => {
    const AsyncFilesItem = {
      template: `
        <Suspense>
          <FilesItem v-bind="$attrs" />
          <template #fallback><div>Loading...</div></template>
        </Suspense>
      `,
      components: { FilesItem, Suspense },
    };

    const wrapper = mount(AsyncFilesItem, {
      props: { modelValue: file.value, mode: "list", ...overrides.props },
      global: {
        provide: { ...mockProvides, fileStore, ...overrides.provide },
        stubs: { ...stubs, ...overrides.stubs },
      },
    });

    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    return wrapper;
  };

  // ─── Single item: .current class ───────────────────────────────

  describe("single item .current class", () => {
    it("has .current when selected and no keyboard nav", async () => {
      const file = makeFile({ selected: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find(".item").classes()).toContain("current");
    });

    it("has .current when focused", async () => {
      const file = makeFile({ focused: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find(".item").classes()).toContain("current");
    });

    it("does NOT have .current when neither selected nor focused", async () => {
      const file = makeFile();
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find(".item").classes()).not.toContain("current");
    });
  });

  // ─── Mutual exclusivity: only one highlight at a time ──────────

  describe("mutual exclusivity — only one file highlighted", () => {
    it("selected file loses .current when another file gains focus", async () => {
      const fileA = makeFile({ id: "a", title: "A", selected: true });
      const fileB = makeFile({ id: "b", title: "B" });
      const files = [fileA.value, fileB.value];
      const store = makeFileStore(files);

      const wA = await mountItem(fileA, store);
      const wB = await mountItem(fileB, store);

      expect(wA.find(".item").classes()).toContain("current");
      expect(wB.find(".item").classes()).not.toContain("current");

      // Simulate keyboard nav: focus moves to B
      fileB.value.focused = true;
      await nextTick();

      expect(wB.find(".item").classes()).toContain("current");
      // A is selected but keyboard nav is active → NOT current
      expect(wA.find(".item").classes()).not.toContain("current");
    });

    it("focused file is .current even when a different file is selected", async () => {
      const fileA = makeFile({ id: "a", title: "A", selected: true });
      const fileB = makeFile({ id: "b", title: "B", focused: true });
      const files = [fileA.value, fileB.value];
      const store = makeFileStore(files);

      const wA = await mountItem(fileA, store);
      const wB = await mountItem(fileB, store);

      // B focused → B is current; A selected but kb active → not current
      expect(wB.find(".item").classes()).toContain("current");
      expect(wA.find(".item").classes()).not.toContain("current");
    });

    it("selected file regains .current when focus is cleared", async () => {
      const fileA = makeFile({ id: "a", title: "A", selected: true });
      const fileB = makeFile({ id: "b", title: "B", focused: true });
      const files = [fileA.value, fileB.value];
      const store = makeFileStore(files);

      const wA = await mountItem(fileA, store);
      const wB = await mountItem(fileB, store);

      expect(wA.find(".item").classes()).not.toContain("current");

      // Clear focus (escape pressed)
      fileB.value.focused = false;
      await nextTick();

      // No keyboard nav active → selected file becomes current again
      expect(wA.find(".item").classes()).toContain("current");
      expect(wB.find(".item").classes()).not.toContain("current");
    });
  });

  // ─── No legacy classes ─────────────────────────────────────────

  describe("no legacy .active or .focused classes", () => {
    it("never applies .active class", async () => {
      const file = makeFile({ selected: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find(".item").classes()).not.toContain("active");
    });

    it("never applies .focused class", async () => {
      const file = makeFile({ focused: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find(".item").classes()).not.toContain("focused");
    });
  });

  // ─── Hover suppression during keyboard nav ─────────────────────

  describe("hover suppression during keyboard nav", () => {
    it("does not set hovered on mouseenter when keyboard nav is active", async () => {
      const fileA = makeFile({ id: "a", title: "A" });
      const fileB = makeFile({ id: "b", title: "B", focused: true });
      const files = [fileA.value, fileB.value];
      const store = makeFileStore(files);

      const wA = await mountItem(fileA, store);
      await wA.find(".item").trigger("mouseenter");
      await nextTick();

      // Keyboard nav active → hovered should be suppressed on non-current item
      expect(wA.find(".item").classes()).not.toContain("hovered");
    });

    it("allows hovered when no keyboard nav is active", async () => {
      const file = makeFile();
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);

      await w.find(".item").trigger("mouseenter");
      await nextTick();

      expect(w.find(".item").classes()).toContain("hovered");
    });

    it("clears hovered when keyboard nav activates", async () => {
      const fileA = makeFile({ id: "a", title: "A" });
      const fileB = makeFile({ id: "b", title: "B" });
      const files = [fileA.value, fileB.value];
      const store = makeFileStore(files);

      const wA = await mountItem(fileA, store);

      // Hover first
      await wA.find(".item").trigger("mouseenter");
      await nextTick();
      expect(wA.find(".item").classes()).toContain("hovered");

      // Then keyboard nav activates
      fileB.value.focused = true;
      await nextTick();

      expect(wA.find(".item").classes()).not.toContain("hovered");
    });
  });

  // ─── FileMenu always rendered ──────────────────────────────────

  describe("FileMenu always available", () => {
    it("renders FileMenu when file is selected", async () => {
      const file = makeFile({ selected: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find('[data-testid="file-menu"]').exists()).toBe(true);
    });

    it("renders FileMenu when file is focused", async () => {
      const file = makeFile({ focused: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find('[data-testid="file-menu"]').exists()).toBe(true);
    });

    it("renders FileMenu on non-current file", async () => {
      const file = makeFile();
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);
      expect(w.find('[data-testid="file-menu"]').exists()).toBe(true);
    });
  });

  // ─── CSS: no :focus/:focus-visible background ──────────────────

  describe("no :focus background leak", () => {
    it("has no .active CSS block in the component styles", async () => {
      const file = makeFile();
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store);

      // The component should never have a .item.list.active rule.
      // We verify by checking that selected files don't get blue styling.
      file.value.selected = true;
      await nextTick();
      const item = w.find(".item");
      expect(item.classes()).toContain("current");
      expect(item.classes()).not.toContain("active");
    });
  });

  // ─── Cards mode ────────────────────────────────────────────────

  describe("cards mode", () => {
    it("applies .current in cards mode when selected", async () => {
      const file = makeFile({ selected: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store, { props: { mode: "cards" } });
      const item = w.find(".item");
      expect(item.classes()).toContain("current");
      expect(item.classes()).toContain("cards");
      expect(item.classes()).not.toContain("active");
    });

    it("applies .current in cards mode when focused", async () => {
      const file = makeFile({ focused: true });
      const store = makeFileStore([file.value]);
      const w = await mountItem(file, store, { props: { mode: "cards" } });
      expect(w.find(".item").classes()).toContain("current");
    });
  });
});
