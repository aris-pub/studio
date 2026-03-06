<script setup>
  import {
    ref,
    shallowRef,
    reactive,
    computed,
    watch,
    watchEffect,
    inject,
    isRef,
    provide,
    useTemplateRef,
    nextTick,
    onMounted,
    onUnmounted,
  } from "vue";
  import { useElementSize, useScroll } from "@vueuse/core";
  import useElementVisibilityObserver from "@/composables/useElementVisibilityObserver";
  import { registerAsFallback } from "@/composables/useKeyboardShortcuts.js";
  import { useHeadInjection } from "@/composables/useHeadInjection.js";
  import { IconMessageFilled } from "@tabler/icons-vue";
  import useClosable from "@/composables/useClosable.js";
  import ReaderTopbar from "./ReaderTopbar.vue";
  import Dock from "./Dock.vue";
  import Editor from "./Editor.vue";
  import ScrollbarMinimap from "./ScrollbarMinimap.vue";
  import DockableSearch from "./DockableSearch.vue";
  import DockableAnnotations from "./DockableAnnotations.vue";

  const props = defineProps({
    showEditor: { type: Boolean, default: false },
    showSearch: { type: Boolean, default: false },
  });
  const file = defineModel({ type: Object });
  defineOptions({ inheritAttrs: false });

  // Mount the manuscript
  const manuscriptRef = useTemplateRef("manuscript-ref");
  watch(
    () => manuscriptRef.value?.mountPoint,
    (newVal) => {
      if (!newVal) return;
      file.value.isMountedAt = newVal;
    },
    { immediate: true }
  );
  provide("manuscriptRef", manuscriptRef);

  // Shared awareness ref — EditorCodeMirror writes to it, ScrollbarMinimap reads it
  const awareness = shallowRef(null);
  provide("awareness", awareness);

  // Expose some of the geometry
  const innerRef = useTemplateRef("inner-right-ref");
  const midColRef = useTemplateRef("middle-column-ref");
  const rgtColRef = useTemplateRef("right-column-ref");
  const overlayToggleRef = useTemplateRef("overlay-toggle-ref");
  const columnSizes = reactive({
    middle: { width: 0, height: 0 },
    right: { width: 0, height: 0 },
    inner: { width: 0, height: 0 },
  });
  const { width: midColW, height: midColH } = useElementSize(midColRef);
  const { width: rgtColW, height: rgtColH } = useElementSize(rgtColRef);
  const { width: innerW, height: innerH } = useElementSize(innerRef);
  watchEffect(() => {
    columnSizes.middle.width = midColW.value;
    columnSizes.middle.height = midColH.value;
    columnSizes.right.width = rgtColW.value;
    columnSizes.right.height = rgtColH.value;
    columnSizes.inner.width = innerW.value;
    columnSizes.inner.height = innerH.value;
  });
  provide("columnSizes", columnSizes);

  const { y: yScroll } = useScroll(innerRef);
  const yScrollPercent = computed(
    () => (yScroll.value / (manuscriptRef.value?.$el.clientHeight ?? 1)) * 100
  );
  provide("yScroll", yScrollPercent);

  // File and file settings
  const api = inject("api");

  // Head injection composable
  const { processStructuredContent } = useHeadInjection(api);

  watchEffect((onCleanup) => {
    if (!file.value || !file.value.id) return;

    // Skip if we already have HTML and structured content has been processed
    if (file.value.html && file.value._structuredProcessed) return;

    let cancelled = false;
    const fetchContent = async () => {
      try {
        // Try structured format first for tooltip support
        const response = await api.get(`/files/${file.value.id}/content?format=structured`);
        if (!cancelled && file.value) {
          const data = response.data;

          // Check if we got a structured response
          if (data && typeof data === "object" && data.body) {
            // Process structured response
            file.value.html = data.body;
            await processStructuredContent(data, manuscriptRef);
            file.value._structuredProcessed = true;
          } else {
            // Fallback to plain HTML response
            file.value.html = data;
            file.value._structuredProcessed = false;
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching structured content, trying plain HTML:", error);
          // Fallback to plain HTML endpoint
          try {
            const fallbackResponse = await api.get(`/files/${file.value.id}/content`);
            if (!cancelled && file.value) {
              file.value.html = fallbackResponse.data;
              file.value._structuredProcessed = false;
            }
          } catch (fallbackError) {
            if (!cancelled) {
              console.error("Error fetching HTML:", fallbackError);
            }
          }
        }
      }
    };

    fetchContent();
    onCleanup(() => (cancelled = true));
  });
  const fileSettings = inject("fileSettings");

  // Is main title visible?
  const isMainTitleVisible = ref(true);
  const manuscriptTitle = ref("");
  let tearDown = () => {};
  watch(
    () => [file.value, manuscriptRef.value],
    async () => {
      if (!file.value || !manuscriptRef.value || !manuscriptRef.value.$el) return;
      tearDown();

      const mainTitle = manuscriptRef.value.$el.querySelector("section.level-1 > .heading.hr");
      if (!mainTitle) return;

      // Extract manuscript H1 text
      const h1 = mainTitle.querySelector("h1, h2, h3");
      manuscriptTitle.value = h1?.textContent?.trim() || file.value?.title || "";

      const { isVisible, tearDown: newTearDown } = useElementVisibilityObserver(mainTitle);
      isMainTitleVisible.value = isVisible.value;

      const stopWatch = watch(isVisible, (newVal) => (isMainTitleVisible.value = newVal));
      tearDown = () => {
        newTearDown();
        stopWatch();
      };
    },
    { immediate: true }
  );
  onUnmounted(() => tearDown());

  // Scroll-direction hysteresis: only show topbar when scrolling down past title
  const lastScrollTop = ref(0);
  const scrollingDown = ref(false);
  function onManuscriptScroll() {
    if (!innerRef.value) return;
    const st = innerRef.value.scrollTop;
    scrollingDown.value = st > lastScrollTop.value;
    lastScrollTop.value = st;
  }
  onMounted(() => {
    innerRef.value?.addEventListener("scroll", onManuscriptScroll, { passive: true });
  });
  onUnmounted(() => {
    innerRef.value?.removeEventListener("scroll", onManuscriptScroll);
  });

  // Section breadcrumb: track the current visible section heading
  const currentSection = ref("");
  const activeSections = ref([]);
  function updateSectionBreadcrumb() {
    if (!manuscriptRef.value?.$el || !innerRef.value) return;
    const el = manuscriptRef.value.$el;
    const sections = el.querySelectorAll("section[class*='level-']");
    if (!sections.length) { currentSection.value = ""; return; }

    const scrollTop = innerRef.value.scrollTop;
    const containerRect = innerRef.value.getBoundingClientRect();
    const threshold = containerRect.top + 60;

    const visible = [];
    for (const section of sections) {
      const heading = section.querySelector(
        ":scope > .heading.hr .hr-content-zone :is(h1,h2,h3,h4,h5,h6)"
      );
      if (!heading) continue;
      const rect = heading.getBoundingClientRect();
      if (rect.top <= threshold) {
        const levelClass = [...section.classList].find((c) => c.startsWith("level-"));
        const level = levelClass ? parseInt(levelClass.split("-")[1], 10) : 1;
        visible.push({ level, text: heading.textContent.trim() });
      }
    }

    // Keep the deepest heading per level (last one scrolled past)
    const byLevel = new Map();
    for (const v of visible) {
      byLevel.set(v.level, v.text);
    }

    // Build breadcrumb from shallowest to deepest
    const levels = [...byLevel.keys()].sort((a, b) => a - b);
    // Skip level 1 (the manuscript title, already shown or obvious)
    const crumbs = levels.filter((l) => l > 1).map((l) => byLevel.get(l));
    activeSections.value = crumbs;
    currentSection.value = crumbs.join(" > ");
  }
  watch(
    () => manuscriptRef.value,
    async (val) => {
      if (!val) return;
      await nextTick();
      updateSectionBreadcrumb();
    }
  );
  onMounted(() => {
    innerRef.value?.addEventListener("scroll", updateSectionBreadcrumb, { passive: true });
  });
  onUnmounted(() => {
    innerRef.value?.removeEventListener("scroll", updateSectionBreadcrumb);
  });

  // Scroll to top
  function scrollToTop() {
    innerRef.value?.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Keyboard shortcuts
  registerAsFallback(manuscriptRef);

  // Focus management for Page Up/Down keys
  onMounted(async () => {
    await nextTick();
    // Ensure the manuscript container can receive focus for keyboard events
    if (innerRef.value) {
      innerRef.value.setAttribute("tabindex", "-1");
      innerRef.value.focus();
    }
  });

  // Responsiveness to viewport and various modes
  const mobileMode = inject("mobileMode");
  const focusMode = inject("focusMode");
  const drawerOpen = inject("drawerOpen");
  const annotations = inject("annotations", ref([]));
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const hasAnnotations = computed(() => {
    const list = isRef(annotations) ? annotations.value : annotations;
    return list && list.length > 0;
  });
  // Available width for annotation cards: space from manuscript right edge to container clip edge
  const rightColumnMaxWidth = computed(() => {
    const midW = columnSizes.middle.width;
    const manuscriptW = Math.min(720, midW);
    const spare = midW - manuscriptW;
    // When editor is open, manuscript is left-aligned so all spare space is on the right
    // When editor is closed, manuscript is centered so only half the spare is on the right
    const rightMargin = props.showEditor ? spare : spare / 2;
    return `${Math.max(rightMargin, 0)}px`;
  });
  const showAnnotationCards = computed(() => {
    const midW = columnSizes.middle.width;
    if (midW === 0) return true; // Not yet measured
    const manuscriptW = Math.min(720, midW);
    const spare = midW - manuscriptW;
    const rightMargin = props.showEditor ? spare : spare / 2;
    return rightMargin >= 120;
  });

  // Overlay panel for annotations at narrow viewports
  const annotationOverlayOpen = ref(false);
  const annotationCount = computed(() => {
    const list = isRef(annotations) ? annotations.value : annotations;
    return list?.length ?? 0;
  });

  watch(showAnnotationCards, (visible) => {
    if (visible) annotationOverlayOpen.value = false;
  });

  watch(activeAnnotationId, (id) => {
    if (id != null && !showAnnotationCards.value) annotationOverlayOpen.value = true;
  });

  const { activate: activateOverlayClosable, deactivate: deactivateOverlayClosable } = useClosable({
    onClose: () => (annotationOverlayOpen.value = false),
    closeOnEsc: true,
    closeOnOutsideClick: false,
    autoActivate: false,
  });

  const overlayPanelRef = useTemplateRef("overlay-panel-ref");

  watch(annotationOverlayOpen, async (open) => {
    if (open) {
      activateOverlayClosable();
      await nextTick();
      overlayPanelRef.value?.focus();
    } else {
      deactivateOverlayClosable();
      overlayToggleRef.value?.focus();
    }
  });
</script>

<template>
  <Suspense>
    <div
      class="outer"
      :class="{ focus: focusMode, mobile: mobileMode, narrow: drawerOpen }"
      :data-testid="$attrs['data-testid']"
    >
      <div class="outer-topbar">
        <DockableSearch v-if="showSearch" />
      </div>

      <div class="inner-wrapper">
        <div v-if="showEditor" data-testid="workspace-editor" class="inner left">
          <Editor v-model="file" />
        </div>

        <div
          v-if="!mobileMode || !showEditor"
          ref="inner-right-ref"
          data-testid="manuscript-container"
          class="inner right"
        >
          <div ref="middle-column-ref" class="middle-column">
            <Dock class="dock middle top">
              <ReaderTopbar
                :show-title="!isMainTitleVisible"
                :manuscript-title="manuscriptTitle"
                :current-section="currentSection"
                @scroll-to-top="scrollToTop"
              />
            </Dock>
            <Dock class="dock middle main">
              <ManuscriptWrapper
                v-if="file.html && (!mobileMode || (mobileMode && !showEditor))"
                ref="manuscript-ref"
                :key="file.html"
                data-testid="manuscript-viewer"
                :class="{ 'title-visible': isMainTitleVisible }"
                :html-string="file.html || ''"
                :keys="true"
                :settings="fileSettings"
                :show-footer="true"
              />
              <div
                v-if="hasAnnotations && !mobileMode && showAnnotationCards"
                ref="right-column-ref"
                class="right-column"
              >
                <DockableAnnotations aligned />
              </div>
            </Dock>
          </div>

          <Transition name="overlay-slide">
            <div
              v-if="annotationOverlayOpen && !showAnnotationCards"
              ref="overlay-panel-ref"
              class="annotation-overlay"
              role="complementary"
              aria-label="Annotations panel"
              tabindex="-1"
            >
              <Pane>
                <template #header>
                  <span class="overlay-header-title">
                    <Icon name="MessageFilled" />
                    <h3>Annotations</h3>
                  </span>
                  <ButtonClose @close="annotationOverlayOpen = false" />
                </template>
                <DockableAnnotations />
              </Pane>
            </div>
          </Transition>

          <ScrollbarMinimap :file="file" mode="workspace" />
        </div>

        <button
          v-if="hasAnnotations && !mobileMode && !showAnnotationCards"
          ref="overlay-toggle-ref"
          class="annotation-overlay-toggle"
          :aria-label="annotationOverlayOpen ? 'Hide annotations' : `Show ${annotationCount} annotations`"
          @click="annotationOverlayOpen = !annotationOverlayOpen"
        >
          <IconMessageFilled :size="16" />
          <span class="toggle-count">{{ annotationCount }}</span>
        </button>
        <Tooltip :anchor="overlayToggleRef" content="Annotations" placement="left" />
      </div>

      <!-- <Drawer :class="{ focus: focusMode, mobile: mobileMode }" /> -->
    </div>
  </Suspense>
</template>

<style scoped>
  .outer {
    --outer-padding: 8px;
    --topbar-height: 48px;

    display: flex;
    flex-direction: column;
    z-index: 1;
    box-shadow: var(--shadow-soft);
    background-color: v-bind(fileSettings.background);
    border-radius: 16px;
    width: 100%;
    padding-top: 16px;
    will-change: width, left, border-radius;
    transition:
      width var(--transition-duration) ease,
      left var(--transition-duration) ease,
      border-radius var(--transition-duration) ease;
  }

  .outer.narrow {
    left: calc(var(--sidebar-width) + 64px);
    width: calc(100% - var(--sidebar-width));
  }

  .outer.focus {
    width: 100%;
    left: 0;
    border-radius: 0;
  }

  .inner-wrapper {
    position: relative;
    height: 100%;
    display: flex;
    overflow-y: hidden;
    background-color: v-bind(fileSettings.background);
    justify-content: center;
    will-change: border-radius, height, top;
    border-radius: 0 0 16px 16px;
    transition:
      border-radius var(--transition-duration) ease,
      height var(--transition-duration) ease,
      top var(--transition-duration) ease;
  }

  .inner {
    width: 50%;

    &.left {
      flex: 2;
      max-width: 600px;
      height: calc(100vh - 32px);
      box-sizing: border-box;
      overflow: hidden;
      border-bottom-left-radius: 16px;
      border-bottom-right-radius: 16px;
      margin-inline: 16px 0;
      padding-bottom: 16px;
    }

    &.right {
      flex: 3;
      overflow-y: auto;
      overflow-x: hidden;
      border-bottom-left-radius: calc(16px - 12px);
      border-bottom-right-radius: calc(16px - 2px);
      padding-inline: 16px 8px;
      padding-bottom: 16px;
      display: flex;
      align-items: flex-start;
      height: calc(100vh - 32px);
      outline: none;
      scrollbar-width: none;
      &::-webkit-scrollbar {
        display: none;
      }
    }
  }

  .outer.mobile {
    padding-top: 0;
    height: calc(100% - 48px);
    border-radius: 0;
  }

  .outer.mobile .inner.left {
    width: 100%;
    padding: 8px;
    margin-inline: 0;
  }

  .inner.focus {
    top: 0;
    height: 100%;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .inner.right .middle-column {
    flex: 1;
    min-width: 0;
  }

  .inner.right .right-column {
    position: absolute;
    left: 100%;
    top: 0;
    width: 280px;
    max-width: v-bind(rightColumnMaxWidth);
    overflow: hidden;
  }

  .outer.mobile .inner.right .middle-column {
    width: 100%;
  }

  .inner.right .middle-column .dock.top.middle {
    position: sticky;
    top: 0;
    z-index: 2;
    max-width: 720px;
    margin: 0 auto;

    &:has(+ .middle.main .rsm-manuscript.title-visible) {
      height: 0;
      overflow: hidden;
    }
    &:has(+ .middle.main .rsm-manuscript:not(.title-visible)) {
      height: 48px;
    }
  }

  .inner.right .dock.main {
    max-width: 720px;
    position: relative;
    overflow-x: visible;
    will-change: padding-top;
    margin: 0 auto;
    height: fit-content;
    transition: padding-top var(--transition-duration) ease;

    &.middle {
      min-height: 100%;
      max-width: 720px;
    }
  }

  /* When editor is open AND annotations visible, push manuscript left for card room */
  .inner.left + .inner.right .dock.main:has(.right-column) {
    margin: 0;
  }

  /* When editor is open with no annotations, give editor more room */
  .inner.left:has(+ .inner.right:not(:has(.right-column))) {
    max-width: 640px;
  }

  .outer.mobile .inner.right {
    padding: 0;
  }

  .outer.mobile .inner.right .dock.main.middle {
    padding-top: 16px;
  }

  .outer.mobile .inner.right .dock.main.middle .rsm-manuscript {
    box-shadow: none;
    border-color: transparent;
    padding-inline: 0;
    padding-block: 16px;
  }

  .rsm-manuscript {
    padding-block: 32px;
    border-radius: 8px;
    border: var(--border-extrathin) solid var(--border-primary);
    border-top: none;
    box-shadow: var(--shadow-soft);
  }

  .drawer.focus {
    opacity: 0;
    transition: opacity var(--transition-duration) ease;
  }

  :deep(.manuscriptwrapper) {
    font-size: v-bind(fileSettings.fontSize) !important;
    font-family: v-bind(fileSettings.fontFamily) !important;
    line-height: v-bind(fileSettings.lineHeight) !important;
    padding-inline: v-bind(fileSettings.marginWidth) !important;
  }

  .outer-topbar {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 3;
  }

  .annotation-overlay-toggle {
    position: absolute;
    top: 8px;
    right: 68px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px 0 8px;
    border-radius: 8px;
    border: var(--border-extrathin) solid var(--border-primary);
    background: var(--surface-page);
    color: var(--gray-700);
    cursor: pointer;
    transition:
      var(--transition-bg-color),
      var(--transition-bd-color),
      box-shadow 0.15s ease;
  }

  .annotation-overlay-toggle:hover {
    background: var(--surface-hover);
    box-shadow: var(--shadow-soft);
    color: var(--gray-800);
  }

  .annotation-overlay-toggle:focus-visible {
    outline: 2px solid var(--border-action);
    outline-offset: 2px;
  }

  .toggle-count {
    font-size: 12px;
    font-weight: var(--weight-medium);
    color: var(--gray-800);
    line-height: 1;
  }

  .annotation-overlay {
    position: fixed;
    top: 8px;
    right: 8px;
    bottom: 8px;
    width: 280px;
    z-index: 999;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-strong);
    border-radius: 16px;
    overflow: hidden;
  }

  .overlay-header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .annotation-overlay :deep(.pane) {
    height: 100%;
    box-shadow: none;
  }

  .annotation-overlay :deep(.annotations) {
    padding: 8px 4px;
  }

  .overlay-slide-enter-active {
    transition: transform 0.3s ease-out;
  }
  .overlay-slide-leave-active {
    transition: transform 0.3s ease-in;
  }
  .overlay-slide-enter-from,
  .overlay-slide-leave-to {
    transform: translateX(100%);
  }
</style>
