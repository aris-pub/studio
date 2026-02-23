<script setup>
  import { computed, inject, toRaw } from "vue";
  import { IconCheck, IconClock, IconDeviceFloppy, IconX, IconMapPin } from "@tabler/icons-vue";
  import { useScrollShadows } from "@/composables/useScrollShadows.js";
  import { useDocumentBreadcrumbs } from "@/composables/useDocumentBreadcrumbs.js";

  defineProps({
    saveStatus: {
      type: String,
      default: "idle",
      validator: (value) => ["idle", "pending", "saving", "saved", "error"].includes(value),
    },
  });

  const file = inject("file", null);
  const cmView = inject("cmView", null);
  const cursorPos = inject("cursorPos", null);
  const lspClient = inject("lspClient", null);
  const documentUri = inject("documentUri", null);
  const collabIsConnected = inject("collabIsConnected", null);
  const collabIsSynced = inject("collabIsSynced", null);

  const { breadcrumbs } = useDocumentBreadcrumbs({
    lspClient,
    documentUri,
    cursorPos,
    cmView,
  });

  // Map LSP SymbolKind to RSM-friendly display names.
  // Sections (kind 2/Module) use the heading text; others use the RSM type name.
  const RSM_KIND_LABELS = {
    5: "Theorem",
    6: "Step",
    12: "Proof",
    14: "Figure",
    18: "References",
    19: "Example",
    23: "Definition",
  };

  function crumbLabel(crumb) {
    if (crumb.kind === 2 || crumb.kind === 3) return crumb.name;
    return RSM_KIND_LABELS[crumb.kind] || crumb.name;
  }

  const displayCrumbs = computed(() => {
    const root = { label: file?.value?.title || "Document", offset: 0 };
    const path = breadcrumbs.value.map((c) => ({ label: crumbLabel(c), offset: c.offset ?? 0 }));
    return [root, ...path];
  });

  function goToCrumb(crumb) {
    const view = cmView?.value;
    if (!view) return;
    const raw = toRaw(view);
    raw.dispatch({ selection: { anchor: crumb.offset } });
    raw.focus();
  }

  const collabDotClass = computed(() => {
    if (!collabIsConnected?.value) return "disconnected";
    if (!collabIsSynced?.value) return "syncing";
    return "connected";
  });

  const { scrollElementRef, showLeftShadow, showRightShadow } = useScrollShadows();
</script>

<template>
  <div class="statusbar">
    <div class="middle-container">
      <div ref="scrollElementRef" class="middle">
        <IconMapPin />
        <template v-for="(crumb, i) in displayCrumbs" :key="i">
          <span v-if="i > 0" class="crumb-sep">&gt;</span>
          <span class="crumb" @click="goToCrumb(crumb)">{{ crumb.label }}</span>
        </template>
      </div>

      <div class="shadow-overlay shadow-left" :class="{ active: showLeftShadow }"></div>
      <div class="shadow-overlay shadow-right" :class="{ active: showRightShadow }"></div>
    </div>
    <div class="right">
      <span class="collab-dot" :class="collabDotClass"></span>
      <IconClock v-if="saveStatus === 'pending'" class="icon-pending" />
      <IconDeviceFloppy v-if="saveStatus === 'saving'" class="icon-saving" />
      <IconCheck
        v-if="saveStatus === 'saved' || saveStatus === 'idle'"
        :class="{ 'icon-idle': saveStatus === 'idle', 'icon-saved': saveStatus === 'saved' }"
      />
      <IconX v-if="saveStatus === 'error'" class="icon-error" />
    </div>
  </div>
</template>

<style scoped>
  .statusbar {
    flex: 0;
    border-top: var(--border-extrathin) solid var(--border-primary);
    display: flex;
    width: 100%;
    justify-content: space-between;
    background-color: var(--gray-100);
    border-radius: 0 0 8px 8px;
  }

  .statusbar * {
    font-size: 12px !important;
    line-height: 18px;
    display: flex;
    align-items: center;
    color: var(--gray-800);
  }

  .middle-container {
    position: relative;
    width: 100%;
    overflow: hidden;
    padding-right: 8px;
  }

  .statusbar > :is(.middle) > :deep(svg) {
    color: var(--gray-800);
  }

  .statusbar .middle {
    padding-inline: 8px;
    gap: 4px;
    overflow-x: auto;
    white-space: nowrap;
    -ms-overflow-style: none;
    scrollbar-width: none;
    height: 100%;
  }

  .statusbar .middle::-webkit-scrollbar {
    display: none;
  }

  .statusbar .middle > :deep(svg) {
    margin-right: 8px;
    flex-shrink: 0;
  }

  .crumb {
    text-wrap: nowrap;
    flex-shrink: 0;
    height: 100%;
    cursor: pointer;
    padding-inline: 2px;
    border-radius: 2px;
  }

  .crumb:hover {
    background-color: var(--surface-hint);
  }

  .crumb-sep {
    flex-shrink: 0;
  }

  .statusbar > .right {
    flex: 0;
    padding-inline: 8px;
    gap: 6px;
  }

  .statusbar > * > :deep(svg) {
    margin: 0;
    transition: color 0.3s ease;
  }

  .collab-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    border-radius: 50%;
    transition: background-color 0.3s ease;
  }

  .collab-dot.connected {
    background-color: var(--success-500);
  }

  .collab-dot.syncing {
    background-color: var(--warning-500);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .collab-dot.disconnected {
    background-color: var(--error-500);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .icon-idle {
    opacity: 0.5;
  }

  .icon-pending {
    color: var(--warning-500);
  }

  .icon-saving {
    color: var(--primary-500);
  }

  .icon-saved {
    color: var(--success-500);
  }

  .icon-error {
    color: var(--error-500);
  }
</style>
