<script setup>
  import { ref, computed, inject, useTemplateRef, useId, onMounted, onUnmounted, watch } from "vue";

  const REACTIONS = [
    { key: "bookmark", icon: "BookmarkFilled", caption: "Notable", color: "var(--blue-500)" },
    { key: "star", icon: "StarFilled", caption: "Inspiring", color: "var(--yellow-500)" },
    { key: "heart", icon: "HeartFilled", caption: "Compelling", color: "var(--red-400)" },
    { key: "check", icon: "CircleCheckFilled", caption: "Understood", color: "var(--green-500)" },
    {
      key: "exclamation",
      icon: "AlertTriangleFilled",
      caption: "Important",
      color: "var(--orange-500)",
    },
    {
      key: "question",
      icon: "HelpSquareRoundedFilled",
      caption: "Unclear",
      color: "var(--pink-500)",
    },
    { key: "quote", icon: "QuoteFilled", caption: "Citable", color: "var(--purple-500)" },
  ];

  const REACTION_MAP = Object.fromEntries(REACTIONS.map((r) => [r.key, r]));

  const myId = useId();
  const file = inject("file");
  const selfRef = useTemplateRef("self-ref");
  const menuRef = useTemplateRef("menu-ref");
  const reactions = inject("reactions", ref([]));
  const reactionActions = inject("reactionActions", null);

  const selectedReaction = ref(null);
  const hrHovered = ref(false);
  const menuOpen = ref(false);
  let nodeId = null;

  const activeReaction = computed(() =>
    selectedReaction.value ? REACTION_MAP[selectedReaction.value] : null
  );

  const triggerIcon = computed(() => activeReaction.value?.icon || "MoodPlus");
  const triggerColor = computed(() => activeReaction.value?.color || "var(--gray-400)");
  const isVisible = computed(() => !!selectedReaction.value || hrHovered.value || menuOpen.value);

  function resolveNodeId() {
    if (nodeId) return nodeId;
    const hr = selfRef.value?.closest(".hr");
    if (!hr) return null;
    nodeId =
      hr.getAttribute("data-nodeid") ||
      hr.querySelector("[data-nodeid]")?.getAttribute("data-nodeid") ||
      null;
    return nodeId;
  }

  // Restore from backend when reactions load
  watch(
    reactions,
    (list) => {
      const nid = resolveNodeId();
      if (!nid) return;
      const match = list.find((r) => r.node_id === nid);
      if (match && match.reaction_type !== selectedReaction.value) {
        selectedReaction.value = match.reaction_type;
        syncToFile();
      }
    },
    { immediate: true }
  );

  function onSelect(key) {
    if (selectedReaction.value === key) {
      selectedReaction.value = null;
    } else {
      selectedReaction.value = key;
    }
    syncToFile();
    persistToBackend();
  }

  function onRemove() {
    selectedReaction.value = null;
    syncToFile();
    persistToBackend();
  }

  function persistToBackend() {
    const nid = resolveNodeId();
    if (!nid || !reactionActions) return;
    if (selectedReaction.value) {
      reactionActions.upsertReaction(nid, selectedReaction.value);
    } else {
      reactionActions.deleteReaction(nid);
    }
  }

  function syncToFile() {
    const currentIcons = file.value.icons || {};
    if (selectedReaction.value) {
      file.value.icons = {
        ...currentIcons,
        [myId]: { class: selectedReaction.value, element: selfRef.value?.parentElement },
      };
    } else {
      const { [myId]: _, ...rest } = currentIcons;
      file.value.icons = rest;
    }
  }

  function onToggle() {
    menuRef.value?.toggle();
    menuOpen.value = !menuOpen.value;
  }

  let hr = null;
  function onHrEnter() {
    hrHovered.value = true;
  }
  function onHrLeave() {
    hrHovered.value = false;
  }

  onMounted(() => {
    hr = selfRef.value?.closest(".hr");
    if (!hr) return;
    hr.addEventListener("mouseenter", onHrEnter);
    hr.addEventListener("mouseleave", onHrLeave);

    // Resolve nodeId and restore from backend data
    resolveNodeId();
    const match = reactions.value.find((r) => r.node_id === nodeId);
    if (match) {
      selectedReaction.value = match.reaction_type;
      syncToFile();
    }
  });

  onUnmounted(() => {
    if (hr) {
      hr.removeEventListener("mouseenter", onHrEnter);
      hr.removeEventListener("mouseleave", onHrLeave);
    }
    const currentIcons = file.value.icons || {};
    if (currentIcons[myId]) {
      const { [myId]: _, ...rest } = currentIcons;
      file.value.icons = rest;
    }
  });
</script>

<template>
  <div ref="self-ref" class="feedback" :class="{ visible: isVisible }">
    <ContextMenu ref="menu-ref" variant="slot" placement="left-start">
      <template #trigger>
        <button
          class="trigger-btn"
          :class="{ 'has-reaction': selectedReaction }"
          :style="{ '--trigger-color': triggerColor }"
          aria-label="Add reaction"
          tabindex="-1"
          @click="onToggle"
        >
          <Icon :name="triggerIcon" />
        </button>
      </template>
      <ContextMenuItem
        v-for="r in REACTIONS"
        :key="r.key"
        :icon="r.icon"
        :caption="r.caption"
        :icon-class="r.key"
        @click="() => onSelect(r.key)"
      />
      <template v-if="selectedReaction">
        <Separator />
        <ContextMenuItem icon="X" caption="Remove" @click="onRemove" />
      </template>
    </ContextMenu>
  </div>
</template>

<style scoped>
  .feedback {
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.15s ease-in-out,
      visibility 0s 0.15s;
    visibility: hidden;
  }

  .feedback.visible {
    opacity: 1;
    pointer-events: auto;
    visibility: visible;
    transition:
      opacity 0.15s ease-in-out,
      visibility 0s;
  }

  .trigger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    color: var(--trigger-color);
    transition: background-color 0.15s ease-in-out;
  }

  .trigger-btn:hover {
    background-color: var(--gray-50);
    box-shadow: var(--shadow-strong);
  }

  .trigger-btn:active {
    background-color: var(--gray-100);
    box-shadow: none;
  }

  .trigger-btn :deep(.tabler-icon) {
    color: var(--trigger-color);
  }

  .trigger-btn.has-reaction :deep(.tabler-icon) {
    fill: var(--trigger-color);
  }

  :deep(.bookmark) {
    color: var(--blue-500);
  }

  :deep(.star) {
    color: var(--yellow-500);
  }

  :deep(.heart) {
    color: var(--red-400);
  }

  :deep(.check) {
    color: var(--green-500);
  }

  :deep(.exclamation) {
    color: var(--orange-500);
  }

  :deep(.question) {
    color: var(--pink-500);
  }

  :deep(.quote) {
    color: var(--purple-500);
  }

  @media (hover: none) and (pointer: coarse) {
    .feedback {
      opacity: 0.3;
      pointer-events: auto;
      visibility: visible;
    }

    .feedback.visible {
      opacity: 1;
    }
  }
</style>
