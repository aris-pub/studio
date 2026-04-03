<script setup>
  import {
    ref,
    shallowRef,
    watch,
    computed,
    inject,
    provide,
    onBeforeMount,
    onMounted,
    onUnmounted,
    useTemplateRef,
    nextTick,
  } from "vue";
  import { useHighlightRenderer } from "@/composables/useHighlightRenderer.js";
  import "tooltipster/dist/css/tooltipster.bundle.min.css";
  import tooltipsterUrl from "tooltipster/dist/js/tooltipster.bundle.min.js?url";

  async function initializeTooltipster() {
    const jqueryModule = await import("jquery");
    window.$ = window.jQuery = jqueryModule.default;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = tooltipsterUrl;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const tooltipsterReady = initializeTooltipster();

  const props = defineProps({
    htmlString: { type: String, required: true },
    keys: { type: Boolean, required: true },
    showFooter: { type: Boolean, default: false },
    settings: { type: Object, default: () => ({}) },
  });
  const emit = defineEmits(["mounted-at"]);

  const api = inject("api");

  const onload = ref(null);
  const onrender = ref(null);
  const onloadCalled = ref(false);
  let lastHtmlString = null;
  let executeRenderInProgress = false;
  let staticPath = null;

  onBeforeMount(async () => {
    const base = api.defaults.baseURL;
    staticPath = `${base}/static/`;

    try {
      await tooltipsterReady;
      const module = await import(/* @vite-ignore */ `${base}/static/onload.js`);
      onload.value = module.onload;
      onrender.value = module.onrender;
    } catch (error) {
      console.error(error);
    }
  });

  const selfRef = useTemplateRef("self-ref");
  const mountPointRef = useTemplateRef("mount-point-ref");

  // Expose mountPoint for external access (Canvas.vue, etc.)
  defineExpose({ mountPoint: computed(() => mountPointRef.value) });

  const executeRender = async () => {
    if (executeRenderInProgress) return;
    if (!selfRef.value || !props.htmlString || !onload.value) return;
    if (props.htmlString === lastHtmlString) return;

    executeRenderInProgress = true;
    lastHtmlString = props.htmlString;

    try {
      const mountPoint = mountPointRef.value;
      if (!mountPoint) {
        executeRenderInProgress = false;
        return;
      }

      // Inject compiled HTML as raw DOM
      mountPoint.innerHTML = props.htmlString;

      if (!onloadCalled.value) {
        window.__rsmInitialized = false;
        await onload.value(mountPoint, { keys: props.keys, path: staticPath });
        onloadCalled.value = true;
      } else if (onrender.value) {
        await onrender.value(mountPoint);
      }

      mountPoint.querySelectorAll('mjx-container[tabindex]').forEach(el => {
        el.removeAttribute('tabindex');
      });
      mountPoint.querySelectorAll('.hr a[href]').forEach(el => {
        el.setAttribute('tabindex', '-1');
      });

    } catch (err) {
      console.error("Render error:", err);
    } finally {
      executeRenderInProgress = false;
      await nextTick();
      applyHighlights();
    }
  };

  watch([onload, () => selfRef.value, () => props.htmlString], executeRender);

  // Highlight rendering
  const annotations = inject("annotations", ref([]));
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const ydoc = inject("ydoc", shallowRef(null));
  const { applyHighlights, setupClickHandler } = useHighlightRenderer(
    annotations,
    {
      get value() {
        return selfRef.value;
      },
    },
    activeAnnotationId,
    ydoc
  );

  let cleanupClickHandler = null;
  onMounted(() => {
    cleanupClickHandler = setupClickHandler();
  });
  onUnmounted(() => {
    cleanupClickHandler?.();
  });
</script>

<template>
  <div ref="self-ref" class="rsm-manuscript">
    <div class="css-links">
      <link rel="stylesheet" :href="`${api.defaults.baseURL}/static/pseudocode.min.css`" />
    </div>

    <div
      ref="mount-point-ref"
      class="manuscriptwrapper"
      :style="{
        backgroundColor: settings.background,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        fontFamily: settings.fontFamily,
        padding: `0 ${settings.marginWidth} 0 ${settings.marginWidth}`,
      }"
    />

    <div v-if="showFooter" class="middle-footer">
      <div class="footer-logo"><Logo type="small" /></div>
    </div>

    <AnnotationMenu />
  </div>
</template>

<style scoped>
  .rsm-manuscript {
    position: relative;
    background-color: v-bind(settings.background) !important;
  }

  .manuscriptwrapper {
    overflow: visible;
    margin: 0 !important;
    max-width: unset !important;
    padding-bottom: 48px !important;
    border-radius: 0px !important;
  }

  .manuscriptwrapper :deep(section.level-1) {
    margin-block: 0px !important;
  }

  .footer-logo {
    display: flex;
    justify-content: center;
    padding-top: 48px;
    padding-bottom: 96px;
  }
</style>

<style>
  /* Sync navigation highlight — applied temporarily when jumping between panes */
  .aris-synctarget-highlight {
    outline: 2px solid var(--orange-300);
    outline-offset: 2px;
    border-radius: 3px;
    animation: synctarget-fade 2s ease-out forwards;
  }

  @keyframes synctarget-fade {
    0% {
      outline-color: var(--orange-300);
      background-color: color-mix(in srgb, var(--orange-200) 20%, transparent);
    }
    100% {
      outline-color: transparent;
      background-color: transparent;
    }
  }

  .cm-synctarget-line {
    background-color: color-mix(in srgb, var(--orange-200) 40%, transparent);
    animation: synctarget-fade-bg 2s ease-out forwards;
  }

  @keyframes synctarget-fade-bg {
    0% { background-color: color-mix(in srgb, var(--orange-200) 40%, transparent); }
    100% { background-color: transparent; }
  }

  .cm-synctarget-gutter {
    background-color: var(--orange-300) !important;
    color: white !important;
    animation: synctarget-fade-gutter 2s ease-out forwards;
  }

  @keyframes synctarget-fade-gutter {
    0% {
      background-color: var(--orange-300);
      color: white;
    }
    100% {
      background-color: transparent;
      color: inherit;
    }
  }
</style>
