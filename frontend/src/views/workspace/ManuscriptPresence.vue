<script setup>
  /**
   * Margin presence markers on the rendered manuscript: one small Avatar per
   * remote collaborator, aligned to the paragraph their cursor is in (std-5v3h).
   * Positions are measured against this component's own root so they stay aligned
   * and scroll with the content (the root sits inside the position:relative
   * .dock.main that wraps the manuscript).
   */
  import { inject, ref, shallowRef, useTemplateRef } from "vue";
  import Avatar from "@/components/base/Avatar.vue";
  import { useReaderPresence } from "@/composables/useReaderPresence.js";

  const awareness = inject("awareness", shallowRef(null));
  const ydoc = inject("ydoc", shallowRef(null));
  const manuscriptRef = inject("manuscriptRef", ref(null));

  const rootRef = useTemplateRef("presence-root");
  const { presences } = useReaderPresence({ awareness, ydoc, manuscriptRef });

  function topFor(block) {
    const root = rootRef.value;
    if (!root || !block) return 0;
    return block.getBoundingClientRect().top - root.getBoundingClientRect().top;
  }
</script>

<template>
  <div ref="presence-root" class="reader-presence" aria-hidden="true">
    <div
      v-for="p in presences"
      :key="p.clientId"
      class="reader-presence__marker"
      :class="{ 'is-idle': !p.active }"
      :style="{ top: `${topFor(p.block)}px`, '--presence-color': p.color }"
    >
      <Avatar :user="p.user" size="sm" :tooltip="true" />
    </div>
  </div>
</template>

<style scoped>
  .reader-presence {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
  }

  .reader-presence__marker {
    position: absolute;
    left: 8px;
    transform: translateY(-2px);
    transition: opacity 0.4s ease;
    pointer-events: auto;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--presence-color, transparent);
  }

  .reader-presence__marker.is-idle {
    opacity: 0.3;
  }
</style>
