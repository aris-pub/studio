<script setup>
  import { ref, watch, useTemplateRef, inject, onMounted, onUnmounted, nextTick } from "vue";
  import SegmentedControl from "@/components/forms/SegmentedControl.vue";

  const selfRef = useTemplateRef("self-ref");
  const api = inject("api");
  const file = inject("file");

  const mode = ref(0); // 0 = Interactive, 1 = Static
  const staticSvg = ref(null);
  const loading = ref(false);
  const mounted = ref(false);
  const hrHovered = ref(false);

  let figureEl = null;
  let staticPath = null;
  let originalChildren = null;
  let hrEl = null;

  async function fetchStatic() {
    if (staticSvg.value || loading.value || !staticPath) return;
    loading.value = true;
    try {
      const fileId = file.value?.id;
      if (!fileId) return;
      const resp = await api.get(`/files/${fileId}/assets/by-name/${staticPath}`);
      staticSvg.value = resp.data.content;
    } catch {
      staticSvg.value = null;
    } finally {
      loading.value = false;
    }
  }

  function swapToStatic() {
    if (!figureEl || !staticSvg.value) return;
    if (!originalChildren) {
      originalChildren = [];
      for (const child of Array.from(figureEl.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === "FIGCAPTION" || child.classList?.contains("figure-toggle")) continue;
        }
        originalChildren.push(child);
      }
    }
    for (const child of originalChildren) {
      if (child.nodeType === Node.ELEMENT_NODE) child.style.display = "none";
    }
    let staticEl = figureEl.querySelector(".static-preview");
    if (!staticEl) {
      staticEl = document.createElement("div");
      staticEl.className = "static-preview";
      staticEl.innerHTML = staticSvg.value;
      figureEl.insertBefore(staticEl, figureEl.firstChild);
    }
    staticEl.style.display = "";
  }

  function swapToInteractive() {
    if (!figureEl) return;
    const staticEl = figureEl.querySelector(".static-preview");
    if (staticEl) staticEl.style.display = "none";
    if (originalChildren) {
      for (const child of originalChildren) {
        if (child.nodeType === Node.ELEMENT_NODE) child.style.display = "";
      }
    }
  }

  watch(mode, async (newMode) => {
    if (newMode === 1) {
      await fetchStatic();
      if (staticSvg.value) {
        swapToStatic();
      } else {
        mode.value = 0;
      }
    } else {
      swapToInteractive();
    }
  });

  onMounted(async () => {
    figureEl = selfRef.value?.closest("figure");
    if (!figureEl) return;
    staticPath = figureEl.getAttribute("data-static");
    if (!staticPath) return;

    // Move ourselves into the figure's hr-info zone (inside the caption)
    await nextTick();
    const infoZone = figureEl.querySelector("figcaption .hr-info");
    if (infoZone && selfRef.value) {
      infoZone.style.flexDirection = "column";
      infoZone.style.alignItems = "center";
      infoZone.style.justifyContent = "flex-start";
      infoZone.appendChild(selfRef.value);
    }

    // Track handrail hover for opacity fade
    hrEl = figureEl.querySelector("figcaption.hr") || figureEl.closest(".hr");
    if (hrEl) {
      hrEl.addEventListener("mouseenter", onHrEnter);
      hrEl.addEventListener("mouseleave", onHrLeave);
    }

    mounted.value = true;
  });

  function onHrEnter() { hrHovered.value = true; }
  function onHrLeave() { hrHovered.value = false; }

  onUnmounted(() => {
    if (hrEl) {
      hrEl.removeEventListener("mouseenter", onHrEnter);
      hrEl.removeEventListener("mouseleave", onHrLeave);
    }
  });
</script>

<template>
  <div ref="self-ref" class="figure-toggle" :class="{ visible: mounted, bright: hrHovered }">
    <SegmentedControl
      v-model="mode"
      :icons="['PlayerPlay', 'Photo']"
      :tooltips="['Show interactive widget', 'Show static PDF version']"
      :default-active="0"
      vertical
      small
    />
  </div>
</template>

<style scoped>
  .figure-toggle {
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
  }

  .figure-toggle.visible {
    opacity: 0.55;
  }

  .figure-toggle.visible.bright {
    opacity: 1;
  }

</style>
