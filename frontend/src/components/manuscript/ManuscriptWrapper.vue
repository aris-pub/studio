<script setup>
  import { ref, watch, computed, inject, onBeforeMount, useTemplateRef, nextTick } from "vue";
  import Manuscript from "./Manuscript.vue";
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
    settings: { type: Object, default: () => {} },
  });
  const emit = defineEmits(["mounted-at"]);

  const api = inject("api");

  // Key to force Manuscript re-creation when content changes
  const manuscriptKey = ref(0);
  watch(
    () => props.htmlString,
    () => {
      manuscriptKey.value++;
    }
  );
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
      if (!onloadCalled.value) {
        await onload.value(selfRef.value, { keys: props.keys, path: staticPath });
        onloadCalled.value = true;
      } else if (onrender.value) {
        await onrender.value(selfRef.value);
      }
    } catch (err) {
      console.error("Render error:", err);
    } finally {
      executeRenderInProgress = false;
    }
  };

  watch([onload, () => selfRef.value, () => props.htmlString], executeRender);

  const manuscriptRef = useTemplateRef("manuscript-ref");
  defineExpose({ mountPoint: computed(() => manuscriptRef.value?.mountPoint) });
</script>

<template>
  <div ref="self-ref" class="rsm-manuscript">
    <div class="css-links">
      <link rel="stylesheet" :href="`${api.defaults.baseURL}/static/pseudocode.min.css`" />
    </div>

    <Manuscript
      ref="manuscript-ref"
      :key="manuscriptKey"
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
