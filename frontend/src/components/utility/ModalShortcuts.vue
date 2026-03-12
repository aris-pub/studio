<script setup>
  import { ref, onMounted } from "vue";
  import {
    getRegisteredComponents,
    getComponentMetadata,
  } from "@/composables/useKeyboardShortcuts.js";

  const props = defineProps({});
  const emit = defineEmits(["close"]);

  // Shortcuts modal
  const shortcutsData = ref({});

  const getData = () => {
    const comps = getRegisteredComponents();
    const metadata = getComponentMetadata();

    const excludedKeys = new Set(["escape", "enter", "arrowdown", "arrowup", "j", "k", "?"]);
    const hasShortcuts = (shortcuts) => Object.keys(shortcuts).length > 0;
    const filterShortcuts = (shortcuts) =>
      Object.fromEntries(Object.entries(shortcuts).filter(([key]) => !excludedKeys.has(key)));

    // Build enhanced shortcuts data with component names and descriptions
    const enhancedData = {};

    Object.entries(comps).forEach(([componentId, shortcuts]) => {
      const filteredShortcuts = filterShortcuts(shortcuts);
      if (!hasShortcuts(filteredShortcuts)) return;

      const componentName = metadata[componentId]?.name || `Component-${componentId}`;

      enhancedData[componentName] = {
        componentId,
        shortcuts: filteredShortcuts,
      };
    });

    // Remove duplicates based on shortcut patterns, keeping the first occurrence
    const seenShortcutPatterns = new Set();
    const deduplicatedData = {};

    Object.entries(enhancedData).forEach(([componentName, data]) => {
      const shortcutKeys = Object.keys(data.shortcuts).sort();
      const pattern = shortcutKeys.join("|");

      if (!seenShortcutPatterns.has(pattern)) {
        seenShortcutPatterns.add(pattern);
        deduplicatedData[componentName] = data;
      }
    });

    shortcutsData.value = deduplicatedData;
  };

  onMounted(() => {
    getData();
  });
</script>

<template>
  <Modal @close="emit('close')">
    <template #header>
      <div>Keyboard Shortcuts</div>
    </template>

    <div
      v-for="(componentData, componentName) in shortcutsData"
      :key="componentName"
      class="component-section"
    >
      <h6 class="component-title text-h6">{{ componentName }}</h6>
      <div class="shortcuts-grid">
        <div
          v-for="(shortcutData, key) in componentData.shortcuts"
          :key="key"
          class="shortcut-item"
        >
          <div class="shortcut-key-container">
            <kbd v-for="keyPart in key.split(',')" :key="keyPart" class="key">
              {{ keyPart.trim() }}
            </kbd>
          </div>
          <div class="shortcut-description">
            <span class="description-text">
              {{ shortcutData.description || shortcutData.fn?.name || "Execute action" }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
  .component-section {
    margin-bottom: 16px;
    border: var(--border-extrathin) solid var(--gray-200);
    border-radius: 8px;
    padding: 20px;
    background-color: var(--surface-page);
  }

  .component-title {
    margin: 0 0 16px 0;
    color: var(--extra-dark);
    border-bottom: var(--border-extrathin) solid var(--gray-100);
    padding-bottom: 8px;
  }

  .shortcuts-grid {
    display: grid;
    gap: 8px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 8px 0;
    border-bottom: var(--border-extrathin) solid var(--gray-50);
  }

  .shortcut-key-container {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: calc(32px * 2 + 8px);
    flex-shrink: 0;
  }

  .key {
    background-color: var(--gray-75);
    height: 32px;
    width: 32px;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    text-transform: uppercase;
  }

  .shortcut-description {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .description-text {
    color: var(--dark);
  }
</style>
