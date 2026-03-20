<script setup>
  import {
    ref,
    watch,
    computed,
    inject,
    onBeforeMount,
    onMounted,
    onUnmounted,
    useTemplateRef,
    nextTick,
  } from "vue";
  import Manuscript from "./Manuscript.vue";
  import { useHighlightRenderer } from "@/composables/useHighlightRenderer.js";
  import "tooltipster/dist/css/tooltipster.bundle.min.css";
  import tooltipsterUrl from "tooltipster/dist/js/tooltipster.bundle.min.js?url";

  // Load jQuery via import, then Tooltipster via script tag to bypass CommonJS detection
  async function initializeTooltipster() {
    const jqueryModule = await import("jquery");
    window.$ = window.jQuery = jqueryModule.default;

    // Load Tooltipster via script tag - this makes UMD use the global jQuery path
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

  // No need to reset onloadCalled — Manuscript is no longer destroyed/recreated
  // on recompile. Subsequent renders use onrender() (math + icons) instead of
  // onload() (full handrail/keyboard/minimap setup).
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
      // Wait for jQuery and Tooltipster to be ready
      await tooltipsterReady;

      // Load RSM's onload.js
      const module = await import(/* @vite-ignore */ `${base}/static/onload.js`);
      onload.value = module.onload;
      onrender.value = module.onrender;
    } catch (error) {
      console.error(error);
    }
  });

  const selfRef = useTemplateRef("self-ref");

  const executeRender = async () => {
    if (executeRenderInProgress) {
      return;
    }

    if (!selfRef.value || !props.htmlString || !onload.value) {
      return;
    }
    if (props.htmlString === lastHtmlString) {
      return;
    }

    executeRenderInProgress = true;
    lastHtmlString = props.htmlString;

    await nextTick();

    try {
      const mountPoint = manuscriptRef.value?.mountPoint;
      if (!mountPoint) {
        executeRenderInProgress = false;
        return;
      }

      // Strip stale MathJax output and restore raw LaTeX ONLY when MathJax
      // containers are present. Without this guard, Temml's rendered output
      // gets reset to raw LaTeX on every recompile, causing a visual flash.
      const mjxContainers = mountPoint.querySelectorAll('span.math mjx-container, div.mathblock mjx-container');
      if (mjxContainers.length) {
        mjxContainers.forEach(el => el.remove());
        mountPoint.querySelectorAll('span.math[data-latex]').forEach(el => {
          el.textContent = '\\(' + el.dataset.latex + '\\)';
        });
        mountPoint.querySelectorAll('div.mathblock[data-latex]').forEach(el => {
          const contentEl = el.querySelector('.hr-content-zone') || el;
          contentEl.textContent = '$$' + el.dataset.latex + '$$';
        });
      }

      if (!onloadCalled.value) {
        // Reset __rsmInitialized so onload re-runs setup() (handrails)
        // and setup2() (keyboard) on the new DOM after Manuscript recreation.
        window.__rsmInitialized = false;
        await onload.value(mountPoint, { keys: props.keys, path: staticPath });
        onloadCalled.value = true;
      } else if (onrender.value) {
        await onrender.value(mountPoint);
      }
      // Remove non-handrail focusable elements from the tab order so j/k
      // navigation only stops on handrails, not on inline links or math.
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

  const manuscriptRef = useTemplateRef("manuscript-ref");
  defineExpose({ mountPoint: computed(() => manuscriptRef.value?.mountPoint) });

  // Highlight rendering
  const annotations = inject("annotations", ref([]));
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const { applyHighlights, setupClickHandler } = useHighlightRenderer(
    annotations,
    {
      get value() {
        return selfRef.value;
      },
    },
    activeAnnotationId
  );

  let cleanupClickHandler = null;
  onMounted(() => {
    cleanupClickHandler = setupClickHandler();
  });
  onUnmounted(() => {
    cleanupClickHandler?.();
  });

  // No separate highlight watch needed — executeRender calls applyHighlights
  // after Temml math rendering completes.
</script>

<template>
  <div ref="self-ref" class="rsm-manuscript">
    <div class="css-links">
      <link rel="stylesheet" :href="`${api.defaults.baseURL}/static/pseudocode.min.css`" />
    </div>

    <Manuscript
      ref="manuscript-ref"
      :html-string="htmlString"
      :settings="settings"
    />

    <div v-if="showFooter" class="middle-footer">
      <div class="footer-logo"><Logo type="small" /></div>
    </div>

    <AnnotationMenu />
  </div>
</template>

<style scoped>
  .rsm-manuscript {
    background-color: v-bind(settings.background) !important;
  }

  .footer-logo {
    display: flex;
    justify-content: center;
    padding-top: 48px;
    padding-bottom: 96px;
  }
</style>
