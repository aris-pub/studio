import { ref, watch, nextTick, isRef, onUnmounted } from "vue";

export const FEEDBACK_COLORS = {
  bookmark: "var(--blue-500)",
  star: "var(--yellow-500)",
  heart: "var(--red-400)",
  check: "var(--green-500)",
  exclamation: "var(--orange-500)",
  question: "var(--pink-500)",
  quote: "var(--purple-500)",
};

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
  const container = el.closest(".inner.right") || el;
  if (!container) return [];

  const sections = el.querySelectorAll("section");
  const marks = [];
  for (const section of sections) {
    const levelClass = [...section.classList].find((c) => c.startsWith("level-"));
    const level = levelClass ? parseInt(levelClass.split("-")[1], 10) : 1;
    // Extract heading text from the first heading-like element
    const heading = section.querySelector("h1, h2, h3, h4, h5, h6, .heading .hr-content-zone");
    const label = heading?.textContent?.trim() || "";
    marks.push({
      top: measureElement(section, container),
      color: "var(--gray-300)",
      type: "section",
      id: `section-${section.id || marks.length}`,
      level,
      label,
    });
  }
  return marks;
}

export function useMinimapMarks(manuscriptRef, options = {}) {
  const { annotations, awareness, file, reactions } = options;
  const marks = ref([]);
  let observer = null;

  function computeMarks() {
    const manuscriptEl = manuscriptRef?.value;
    if (!manuscriptEl) {
      marks.value = [];
      return;
    }
    const el = manuscriptEl.$el || manuscriptEl;
    const container = el.closest(".inner.right") || el;
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
        color: `var(--${colorName}-600)`,
        type: "annotation",
        id: `ann-${annId}`,
        label,
        visibility: ann?.visibility || "private",
      });
    }

    // Feedback icons (from live FeedbackIcon state, or from backend reactions data)
    const fileVal = file && isRef(file) ? file.value : file;
    if (fileVal?.icons && Object.keys(fileVal.icons).length > 0) {
      for (const [iconId, entry] of Object.entries(fileVal.icons)) {
        if (!entry.element) continue;
        const label = entry.class.charAt(0).toUpperCase() + entry.class.slice(1);
        result.push({
          top: measureElement(entry.element, container),
          color: FEEDBACK_COLORS[entry.class] || "var(--gray-500)",
          type: "feedback",
          id: `feedback-${iconId}`,
          label,
        });
      }
    } else {
      const rxnList = reactions && isRef(reactions) ? reactions.value : reactions;
      if (Array.isArray(rxnList)) {
        for (const rxn of rxnList) {
          if (!rxn.node_id) continue;
          const block = el.querySelector(`[data-nodeid="${rxn.node_id}"]`);
          if (!block) continue;
          const label = rxn.reaction_type?.charAt(0).toUpperCase() + rxn.reaction_type?.slice(1);
          result.push({
            top: measureElement(block, container),
            color: FEEDBACK_COLORS[rxn.reaction_type] || "var(--gray-500)",
            type: "feedback",
            id: `feedback-${rxn.node_id}`,
            label,
          });
        }
      }
    }

    // Figures (images, SVGs, HTML assets)
    const figures = el.querySelectorAll("figure");
    let figIdx = 0;
    for (const fig of figures) {
      const caption = fig.querySelector(".label")?.textContent || fig.querySelector("span.label")?.textContent || "";
      const figClass = fig.classList.contains("html") ? "Widget" : "Figure";
      const label = caption || `${figClass} ${figIdx + 1}`;
      result.push({
        top: measureElement(fig, container),
        color: "var(--blue-400)",
        type: "figure",
        id: `figure-${figIdx++}`,
        label,
      });
    }

    // Search highlights (include --current variant so the active match isn't missed)
    const searchMarks = el.querySelectorAll(
      "mark.aris-search-highlight, mark.aris-search-highlight--current"
    );
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
    if (awarenessVal) {
      // Use source length if available, otherwise estimate from scroll height
      const totalLen = fileVal?.source?.length || container.scrollHeight || 1;
      const useCharPos = !!fileVal?.source;
      const states = awarenessVal.getStates();
      for (const [clientId, state] of states) {
        if (clientId === awarenessVal.clientID) continue;
        if (!state.user) continue;
        let pos = 0.5;
        if (state.cursor && useCharPos) {
          pos = Math.max(0, Math.min(1, state.cursor.head / totalLen));
        } else if (state.cursor) {
          pos = Math.max(0, Math.min(1, state.cursor.head / totalLen));
        }
        result.push({
          top: pos,
          color: state.user.avatar_color || state.user.color || "var(--primary-400)",
          type: "presence",
          id: `presence-${clientId}`,
          label: state.user.name,
          userId: state.user.id,
          avatarColor: state.user.avatar_color,
        });
      }
    }

    marks.value = result;
  }

  // Observe search highlight changes via MutationObserver
  let observerDebounce = null;
  function setupObserver() {
    teardownObserver();
    const manuscriptEl = manuscriptRef?.value;
    if (!manuscriptEl) return;
    const el = manuscriptEl.$el || manuscriptEl;
    if (!el) return;

    observer = new MutationObserver(() => {
      clearTimeout(observerDebounce);
      observerDebounce = setTimeout(() => computeMarks(), 100);
    });
    observer.observe(el, { childList: true, subtree: true });
  }

  function teardownObserver() {
    clearTimeout(observerDebounce);
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

  // Watch reactions (backend-persisted feedback, used when FeedbackIcon isn't mounted)
  if (reactions) {
    watch(reactions, () => computeMarks(), { deep: true });
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
    watch(
      () => (isRef(file) ? file.value?.icons : file?.icons),
      () => computeMarks(),
      { deep: true }
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
        // Annotation highlights may render after the manuscript mounts;
        // recompute once more after a short delay to catch them.
        setTimeout(() => computeMarks(), 500);
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
