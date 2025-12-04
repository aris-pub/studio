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
      console.log(`[ManuscriptWrapper] manuscriptKey incremented to ${manuscriptKey.value}`);
    }
  );
  const onload = ref(null);
  const onrender = ref(null);
  const onloadCalled = ref(false);
  let lastHtmlString = null;
  let executeRenderInProgress = false;

  console.log("[ManuscriptWrapper] Component instance created, onloadCalled=false");

  onBeforeMount(async () => {
    const base = api.defaults.baseURL;

    try {
      await import(/* @vite-ignore */ `${base}/static/jquery-3.6.0.js`);
      await import(/* @vite-ignore */ `${base}/static/tooltipster.bundle.js`);
      const module = await import(/* @vite-ignore */ `${base}/static/onload.js`);
      onload.value = module.onload;
      onrender.value = module.onrender;
    } catch (error) {
      console.error(error);
    }
  });

  const selfRef = useTemplateRef("self-ref");

  const executeRender = async () => {
    const preMjxCount = document.querySelectorAll("mjx-container").length;
    const preNestedCount = document.querySelectorAll("mjx-container mjx-container").length;
    console.log(`[ManuscriptWrapper] executeRender called, pre-existing mjx: ${preMjxCount}, nested: ${preNestedCount}`);

    if (executeRenderInProgress) {
      console.log("[ManuscriptWrapper] executeRender early return - already in progress");
      return;
    }

    if (!selfRef.value || !props.htmlString || !onload.value) {
      console.log("[ManuscriptWrapper] executeRender early return - missing refs");
      return;
    }
    if (props.htmlString === lastHtmlString) {
      console.log("[ManuscriptWrapper] executeRender early return - same htmlString");
      return;
    }

    executeRenderInProgress = true;
    console.log("[ManuscriptWrapper] executeRenderInProgress = true");
    lastHtmlString = props.htmlString;

    console.log("[ManuscriptWrapper] Awaiting nextTick...");
    await nextTick();
    console.log("[ManuscriptWrapper] nextTick resolved");

    const rootMjxBefore = selfRef.value.querySelectorAll("mjx-container").length;
    const rootNestedBefore = selfRef.value.querySelectorAll("mjx-container mjx-container").length;
    console.log(`[ManuscriptWrapper] Before MathJax: mjx in root=${rootMjxBefore}, nested=${rootNestedBefore}, onloadCalled=${onloadCalled.value}`);

    try {
      if (!onloadCalled.value) {
        console.log("[ManuscriptWrapper] Taking onload() path (first time)");
        await onload.value(selfRef.value, { keys: props.keys });
        console.log("[ManuscriptWrapper] onload() returned");
        onloadCalled.value = true;
      } else if (onrender.value) {
        console.log("[ManuscriptWrapper] Taking onrender() path (subsequent)");
        await onrender.value(selfRef.value);
        console.log("[ManuscriptWrapper] onrender() returned");
      }
    } catch (err) {
      console.error("Render error:", err);
    } finally {
      executeRenderInProgress = false;
      console.log("[ManuscriptWrapper] executeRenderInProgress = false");
    }

    const rootMjxAfter = selfRef.value.querySelectorAll("mjx-container").length;
    const rootNestedAfter = selfRef.value.querySelectorAll("mjx-container mjx-container").length;
    const docMjxAfter = document.querySelectorAll("mjx-container").length;
    const docNestedAfter = document.querySelectorAll("mjx-container mjx-container").length;
    console.log(`[ManuscriptWrapper] After MathJax: root mjx=${rootMjxAfter}, root nested=${rootNestedAfter}, doc mjx=${docMjxAfter}, doc nested=${docNestedAfter}`);
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
