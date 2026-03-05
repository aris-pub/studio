<script setup>
  import { computed, ref, inject, toRaw, useTemplateRef, watch } from "vue";
  import {
    IconClock,
    IconDeviceFloppy,
    IconCheck,
    IconExclamationCircle,
    IconWifiOff,
    IconMapPin,
  } from "@tabler/icons-vue";
  import { useScrollShadows } from "@/composables/useScrollShadows.js";
  import { useDocumentBreadcrumbs } from "@/composables/useDocumentBreadcrumbs.js";

  const props = defineProps({
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
    raw.dispatch({ selection: { anchor: crumb.offset }, scrollIntoView: true });
    raw.focus();
  }

  // --- Status indicators: "nothing when normal" ---
  // Only show when something is non-normal. "Saved" flashes briefly then disappears.

  const showSavedFlash = ref(false);
  let savedTimer = null;
  watch(
    () => props.saveStatus,
    (status) => {
      if (status === "saved") {
        showSavedFlash.value = true;
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => (showSavedFlash.value = false), 2000);
      } else {
        showSavedFlash.value = false;
      }
    }
  );

  const statusIndicator = computed(() => {
    const connected = collabIsConnected?.value ?? true;
    const synced = collabIsSynced?.value ?? true;

    if (!connected) return { label: "Offline", icon: "wifi-off", cls: "status-error" };
    if (!synced) return { label: "Syncing\u2026", icon: "clock", cls: "status-warning" };
    if (props.saveStatus === "error") return { label: "Save failed", icon: "error", cls: "status-error" };
    if (props.saveStatus === "saving") return { label: "Saving\u2026", icon: "saving", cls: "status-saving" };
    if (props.saveStatus === "pending") return { label: "Unsaved", icon: "clock", cls: "status-warning" };
    if (showSavedFlash.value) return { label: "Saved", icon: "check", cls: "status-saved" };
    return null;
  });

  // Tooltip anchor
  const statusRef = useTemplateRef("status-indicator");

  const statusTooltip = computed(() => {
    const s = statusIndicator.value;
    if (!s) return "";
    const connected = collabIsConnected?.value ?? true;
    if (!connected) return "Connection lost. Changes will sync when reconnected.";
    if (!(collabIsSynced?.value ?? true)) return "Syncing changes with collaborators\u2026";
    if (props.saveStatus === "error") return "Failed to save. Will retry automatically.";
    if (props.saveStatus === "saving") return "Saving changes\u2026";
    if (props.saveStatus === "pending") return "You have unsaved changes.";
    if (showSavedFlash.value) return "All changes saved.";
    return "";
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
    <div v-if="statusIndicator" ref="status-indicator" class="right" :class="statusIndicator.cls">
      <IconWifiOff v-if="statusIndicator.icon === 'wifi-off'" />
      <IconClock v-else-if="statusIndicator.icon === 'clock'" />
      <IconDeviceFloppy v-else-if="statusIndicator.icon === 'saving'" />
      <IconCheck v-else-if="statusIndicator.icon === 'check'" />
      <IconExclamationCircle v-else-if="statusIndicator.icon === 'error'" />
      <span class="status-label">{{ statusIndicator.label }}</span>
    </div>
    <Tooltip v-if="statusIndicator" :anchor="statusRef" :content="statusTooltip" placement="top-end" />
  </div>
</template>

<style scoped>
  .statusbar {
    flex: 0;
    border-top: var(--border-extrathin) solid var(--border-primary);
    display: flex;
    width: 100%;
    justify-content: space-between;
    background-color: var(--surface-hover);
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
    gap: 4px;
    white-space: nowrap;
    cursor: default;
  }

  .statusbar > .right > :deep(svg) {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .status-label {
    font-weight: var(--weight-medium, 500);
  }

  .status-warning {
    color: var(--warning-600);
  }

  .status-saving {
    color: var(--primary-600);
  }

  .status-saved {
    color: var(--success-600);
    animation: fade-out 2s ease forwards;
  }

  .status-error {
    color: var(--error-600);
  }

  @keyframes fade-out {
    0%,
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
