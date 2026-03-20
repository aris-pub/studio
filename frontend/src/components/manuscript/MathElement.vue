<script setup>
  import { watch, onMounted, useTemplateRef } from "vue";

  const TEMML_JS = "https://cdn.jsdelivr.net/npm/temml/dist/temml.min.js";
  const TEMML_CSS = "https://cdn.jsdelivr.net/npm/temml/dist/Temml.css";
  let loadPromise = null;

  function ensureTemml() {
    if (window.temml) return Promise.resolve();
    if (loadPromise) return loadPromise;

    // Check if a Temml script is already loading (e.g. from onload.js)
    const existingScript = document.querySelector(`script[src*="temml"]`);
    if (existingScript) {
      loadPromise = new Promise((resolve) => {
        if (window.temml) { resolve(); return; }
        existingScript.addEventListener("load", resolve);
        existingScript.addEventListener("error", resolve);
        setTimeout(resolve, 5000);
      });
      return loadPromise;
    }

    if (!document.querySelector(`link[href*="temml" i], link[href*="Temml" i]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = TEMML_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = TEMML_JS;
    document.head.appendChild(script);
    loadPromise = new Promise((resolve) => {
      script.onload = resolve;
      script.onerror = resolve;
    });
    return loadPromise;
  }

  const props = defineProps({
    latex: { type: String, required: true },
    display: { type: Boolean, default: false },
  });

  const elRef = useTemplateRef("el");

  function render() {
    if (!elRef.value || !window.temml) return;
    try {
      window.temml.render(props.latex, elRef.value, {
        displayMode: props.display,
        throwOnError: false,
      });
    } catch (err) {
      console.error("temml render error:", err);
    }
  }

  onMounted(async () => {
    await ensureTemml();
    render();
  });

  watch(() => props.latex, render);
</script>

<template>
  <component :is="display ? 'div' : 'span'" ref="el" :class="display ? '' : 'math'" />
</template>
