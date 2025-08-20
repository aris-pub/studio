<script setup>
  import {
    ref,
    reactive,
    computed,
    watch,
    watchEffect,
    inject,
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
  import ReaderTopbar from "./ReaderTopbar.vue";
  import Dock from "./Dock.vue";
  import Editor from "./Editor.vue";
  import DockableMinimap from "./DockableMinimap.vue";
  import DockableSearch from "./DockableSearch.vue";
  import DockableAnnotations from "./DockableAnnotations.vue";
  import DockableChat from "./DockableChat.vue";

  const props = defineProps({
    showEditor: { type: Boolean, default: false },
    showSearch: { type: Boolean, default: false },
    showAiCopilot: { type: Boolean, default: false },
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

  // Expose some of the geometry
  const innerRef = useTemplateRef("inner-right-ref");
  const lftColRef = useTemplateRef("left-column-ref");
  const midColRef = useTemplateRef("middle-column-ref");
  const rgtColRef = useTemplateRef("right-column-ref");
  const columnSizes = reactive({
    left: { width: 0, height: 0 },
    middle: { width: 0, height: 0 },
    right: { width: 0, height: 0 },
    inner: { width: 0, height: 0 },
  });
  const { width: lftColW, height: lftColH } = useElementSize(lftColRef);
  const { width: midColW, height: midColH } = useElementSize(midColRef);
  const { width: rgtColW, height: rgtColH } = useElementSize(rgtColRef);
  const { width: innerW, height: innerH } = useElementSize(innerRef);
  watchEffect(() => {
    columnSizes.left.width = lftColW.value;
    columnSizes.left.height = lftColH.value;
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
  let tearDown = () => {};
  watch(
    () => [file.value, manuscriptRef.value],
    async () => {
      if (!file.value || !manuscriptRef.value || !manuscriptRef.value.$el) return;
      tearDown();

      const mainTitle = manuscriptRef.value.$el.querySelector("section.level-1 > .heading.hr");
      if (!mainTitle) return;

      const { isVisible, tearDown: newTearDown } = useElementVisibilityObserver(mainTitle);
      isMainTitleVisible.value = isVisible.value;

      const stopWatch = watch(isVisible, (newVal) => (isMainTitleVisible.value = newVal));
      tearDown = () => {
        newTearDown();
        stopWatch();
      };
    },
    { immedate: true }
  );
  onUnmounted(() => tearDown());

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
  const annotations = inject("annotations", []);
  const hasAnnotations = computed(() => annotations && annotations.length > 0);
  const middleTopWidth = computed(() => `${columnSizes.middle.width + 8}px`);

  // Chat functionality - controlled by sidebar
  const showChat = computed(() => props.showAiCopilot);
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
          :class="{ 'no-annotations': !hasAnnotations, 'has-chat': showChat }"
        >
          <div ref="left-column-ref" class="left-column">
            <Dock class="dock left top"> </Dock>
            <Dock class="dock left main">
              <DockableChat v-if="showChat" :file-id="file.id" />
            </Dock>
          </div>
          <div ref="middle-column-ref" class="middle-column">
            <Dock class="dock middle top">
              <ReaderTopbar :show-title="!isMainTitleVisible" />
            </Dock>
            <Dock class="dock middle main">
              <ManuscriptWrapper
                v-if="file.html && (!mobileMode || (mobileMode && !showEditor))"
                ref="manuscript-ref"
                data-testid="manuscript-viewer"
                :class="{ 'title-visible': isMainTitleVisible }"
                :html-string="file.html || ''"
                :keys="true"
                :settings="fileSettings"
                :show-footer="true"
              />
            </Dock>
          </div>
          <div v-if="hasAnnotations && !mobileMode" ref="right-column-ref" class="right-column">
            <Dock class="dock right top"> </Dock>
            <Dock class="dock right main">
              <DockableAnnotations />
            </Dock>
          </div>
        </div>
      </div>

      <DockableMinimap v-if="!showEditor" :file="file" side="right" />

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
      flex: 1;
      max-width: 600px;
      border-bottom-left-radius: 16px;
      border-bottom-right-radius: 16px;
      margin-inline: 16px 0;
      padding-bottom: 16px;
    }

    &.right {
      flex: 1;
      overflow: hidden;
      border-bottom-left-radius: calc(16px - 12px);
      border-bottom-right-radius: calc(16px - 2px);
      padding-inline: 16px 8px;
      padding-bottom: 16px;
      display: flex;
      height: 100vh;
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
    /* Use flex instead of fixed width to allow proper space distribution */
    /* between left, middle, and right columns in three-column layout */
    /* Give middle column (manuscript) the majority of space */
    flex: 4; /* Increase flex ratio to give middle column even more space */
    min-width: 0; /* Allow flex shrinking when needed */
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  /* When no annotations are present, middle column should expand to full width */
  .inner.right.no-annotations .middle-column {
    flex: 1; /* Take all available space when no right column */
    max-width: none; /* Remove any width constraints */
  }

  /* When both chat and annotations are closed, middle column takes all space */
  .inner.right.no-annotations:not(.has-chat) .middle-column {
    flex: 1; /* Take all available space when no side panels */
    max-width: none; /* Remove any width constraints */
  }

  .inner.right .left-column {
    /* Left column base styling - no width when empty */
    display: flex;
    flex-direction: column;
    flex: 0 0 0px;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden;
    align-items: flex-start;
    padding: 16px;
    box-sizing: border-box;
  }

  .inner.right.has-chat .left-column {
    /* Chat panel styling when docked */
    flex: 0 0 350px; /* Fixed width for chat panel */
    min-width: 300px; /* Minimum width to prevent collapse */
    max-width: 400px; /* Maximum width to keep it reasonable */
  }

  .inner.right .right-column {
    /* Make annotations panel much narrower */
    /* Annotations should be compact to keep focus on main content */
    flex: 0 0 280px; /* Fixed width for annotations panel - even narrower */
    min-width: 250px; /* Minimum width to prevent collapse */
    max-width: 300px; /* Maximum width to keep it compact */
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .outer.mobile .inner.right .middle-column {
    width: 100%;
  }

  .inner.right .middle-column .dock.top.middle {
    position: sticky;
    top: 0;
    z-index: 2;
    padding-inline: 4px;
    min-width: v-bind(middleTopWidth);
    transform: translateX(-4px);

    background: v-bind(fileSettings.background) !important;

    will-change: opacity;
    transition: opacity 0.3s ease;

    &:has(+ .middle.main .rsm-manuscript.title-visible) {
      height: 2px;
      opacity: 0;
    }
    &:has(+ .middle.main .rsm-manuscript:not(.title-visible)) {
      height: 48px;
      opacity: 1;
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

    &.left {
      min-height: auto;
      max-width: none;
    }
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

  :deep(.float-minimap-wrapper) {
    display: none !important;
  }

  :deep(.mm-wrapper) {
    position: fixed;
  }

  :deep(.manuscriptwrapper) {
    font-size: v-bind(fileSettings.fontSize) !important;
    font-family: v-bind(fileSettings.fontFamily) !important;
    line-height: v-bind(fileSettings.lineHeight) !important;
    padding-inline: v-bind(fileSettings.marginWidth) !important;
  }
</style>
