import { ref, watch, nextTick, isRef, onUnmounted } from "vue";

function measureElement(el, containerEl) {
  const containerRect = containerEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const scrollHeight = containerEl.scrollHeight;
  if (scrollHeight === 0) return 0;
  const top = elRect.top - containerRect.top + containerEl.scrollTop;
  return Math.max(0, Math.min(1, top / scrollHeight));
}

export function computeSectionMarks(manuscriptEl) {
  if (!manuscriptEl) return [];
  const el = manuscriptEl.$el || manuscriptEl;
  const container = el.closest(".inner.right") || el.parentElement;
  if (!container) return [];

  const sections = el.querySelectorAll("section");
  const marks = [];
  for (const section of sections) {
    const levelClass = [...section.classList].find((c) => c.startsWith("level-"));
    const level = levelClass ? parseInt(levelClass.split("-")[1], 10) : 1;
    marks.push({
      top: measureElement(section, container),
      color: "var(--gray-300)",
      type: "section",
      id: `section-${section.id || marks.length}`,
      level,
    });
  }
  return marks;
}

export function useMinimapMarks(manuscriptRef, options = {}) {
  const { annotations, awareness, file } = options;
  const marks = ref([]);
  let observer = null;

  function computeMarks() {
    const manuscriptEl = manuscriptRef?.value;
    if (!manuscriptEl) {
      marks.value = [];
      return;
    }
    const el = manuscriptEl.$el || manuscriptEl;
    const container = el.closest(".inner.right") || el.parentElement;
    if (!container) {
      marks.value = [];
      return;
    }

    const result = [];

    // Sections
    const sections = el.querySelectorAll("section");
    for (const section of sections) {
      const levelClass = [...section.classList].find((c) => c.startsWith("level-"));
      const level = levelClass ? parseInt(levelClass.split("-")[1], 10) : 1;
      const heading = section.querySelector(
        ":scope > .heading.hr .hr-content-zone :is(h1,h2,h3,h4,h5,h6)"
      );
      result.push({
        top: measureElement(section, container),
        color: "var(--gray-300)",
        type: "section",
        id: `section-${section.id || result.length}`,
        level,
        label: heading?.textContent || "",
      });
    }

    // Annotations
    const annotationMarks = el.querySelectorAll("mark[data-annotation-id]");
    const annList = annotations && isRef(annotations) ? annotations.value : annotations;
    const seenAnnIds = new Set();
    for (const mark of annotationMarks) {
      const annId = mark.getAttribute("data-annotation-id");
      if (seenAnnIds.has(annId)) continue;
      seenAnnIds.add(annId);
      const ann = annList?.find((a) => String(a.id) === annId);
      const colorName = ann?.color || "purple";
      const snippet = ann?.selected_text?.slice(0, 40) || mark.textContent?.slice(0, 40) || "";
      const label = snippet ? `"${snippet}${snippet.length >= 40 ? "…" : ""}"` : "Annotation";
      result.push({
        top: measureElement(mark, container),
        color: `var(--${colorName}-400)`,
        type: "annotation",
        id: `ann-${annId}`,
        label,
      });
    }

    // Search highlights
    const searchMarks = el.querySelectorAll("mark.aris-search-highlight");
    let searchIdx = 0;
    for (const mark of searchMarks) {
      result.push({
        top: measureElement(mark, container),
        color: "var(--yellow-400)",
        type: "search",
        id: `search-${searchIdx++}`,
        label: "Search match",
      });
    }

    // Presence (Y.js awareness)
    const awarenessVal = awareness && isRef(awareness) ? awareness.value : awareness;
    const fileVal = file && isRef(file) ? file.value : file;
    if (awarenessVal && fileVal?.source) {
      const totalLen = fileVal.source.length || 1;
      const states = awarenessVal.getStates();
      for (const [clientId, state] of states) {
        if (clientId === awarenessVal.clientID) continue;
        if (!state.cursor || !state.user) continue;
        const pos = Math.max(0, Math.min(1, state.cursor.head / totalLen));
        result.push({
          top: pos,
          color: state.user.color || "var(--primary-400)",
          type: "presence",
          id: `presence-${clientId}`,
          label: state.user.name,
        });
      }
    }

    marks.value = result;
  }

  // Observe search highlight changes via MutationObserver
  function setupObserver() {
    teardownObserver();
    const manuscriptEl = manuscriptRef?.value;
    if (!manuscriptEl) return;
    const el = manuscriptEl.$el || manuscriptEl;
    if (!el) return;

    observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => {
        for (const node of [...m.addedNodes, ...m.removedNodes]) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.classList?.contains("aris-search-highlight") ||
              node.querySelector?.("mark.aris-search-highlight")
            )
              return true;
          }
        }
        return false;
      });
      if (relevant) computeMarks();
    });
    observer.observe(el, { childList: true, subtree: true });
  }

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Watch annotations
  if (annotations) {
    watch(
      annotations,
      async () => {
        await nextTick();
        await nextTick();
        computeMarks();
      },
      { deep: true }
    );
  }

  // Watch file.html changes
  if (file) {
    watch(
      () => (isRef(file) ? file.value?.html : file?.html),
      async () => {
        await nextTick();
        computeMarks();
        setupObserver();
      }
    );
  }

  // Watch manuscriptRef becoming available
  watch(
    () => manuscriptRef?.value,
    async (val) => {
      if (val) {
        await nextTick();
        computeMarks();
        setupObserver();
      }
    },
    { immediate: true }
  );

  // Awareness change listener
  let awarenessCleanup = null;
  if (awareness) {
    watch(
      awareness,
      (newAwareness) => {
        if (awarenessCleanup) awarenessCleanup();
        if (!newAwareness) return;
        const handler = () => computeMarks();
        newAwareness.on("change", handler);
        awarenessCleanup = () => newAwareness.off("change", handler);
      },
      { immediate: true }
    );
  }

  onUnmounted(() => {
    teardownObserver();
    if (awarenessCleanup) awarenessCleanup();
  });

  return { marks, computeMarks };
}
