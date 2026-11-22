<script setup>
  import { watch, onMounted, useTemplateRef } from "vue";
  import { loadRsmLibraries } from "@/utils/renderInlineMath.js";

  const props = defineProps({
    latex: { type: String, required: true },
    display: { type: Boolean, default: false },
  });

  const elRef = useTemplateRef("el");

  // rsm's renderMath typesets with the document's notation macros.
  async function render() {
    if (!elRef.value) return;
    try {
      const libs = await loadRsmLibraries();
      await libs.renderMath(props.latex, elRef.value, { display: props.display });
    } catch (err) {
      console.error("MathJax render error:", err);
    }
  }

  onMounted(render);
  watch(() => props.latex, render);
</script>

<template>
  <component :is="display ? 'div' : 'span'" ref="el" :class="display ? '' : 'math'" />
</template>
