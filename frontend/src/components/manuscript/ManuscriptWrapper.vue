<script setup>
  import { ref, watch, computed, inject, onBeforeMount, useTemplateRef, nextTick } from "vue";
  import Manuscript from "./Manuscript.vue";

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

  // Load a script as a regular (non-module) script tag
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  onBeforeMount(async () => {
    const base = api.defaults.baseURL;

    try {
      // Load jQuery and Tooltipster as regular scripts (they're not ES modules)
      await loadScript(`${base}/static/jquery-3.6.0.js`);
      await loadScript(`${base}/static/tooltipster.bundle.js`);
      // Load onload.js as ES module (it uses export)
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
        await onload.value(selfRef.value, { keys: props.keys });
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
