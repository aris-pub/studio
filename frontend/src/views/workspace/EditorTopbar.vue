<script setup>
  import { ref, inject, watch } from "vue";
  const emit = defineEmits(["compile", "upload", "sync-to-preview"]);
  const activeIndex = defineModel({ type: Number, required: true });
  const focusMode = inject("focusMode");
  const file = inject("file");
  const fileSettings = inject("fileSettings");
  const isCompiling = inject("isCompiling", ref(false));
  const syncBtnRef = ref(null);

  // Word counter
  const numWords = ref(0);
  const countWords = (text) => {
    if (!text || typeof text !== "string") return 0;
    // Match word characters (letters, numbers, underscores)
    const words = text.match(/\b\w+\b/g);
    return words ? words.length : 0;
  };
  const debouncedCounter = (() => {
    let timeoutId;
    return function countWordsDebounced(text, callback, delay = 200) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const count = countWords(text);
        callback(count);
      }, delay);
    };
  })();
  watch(
    () => file.value?.source,
    (newText) => {
      debouncedCounter(newText, (count) => {
        numWords.value = count;
      });
    },
    { immediate: true }
  );

  // Handle file selection
  const assetInputRef = ref(null);
  const selectedAsset = ref(null);
  const handleAssetSelect = (event) => {
    const asset = event.target.files[0];
    if (asset) {
      selectedAsset.value = asset;
      emit("upload", asset);
    }
    event.target.value = "";
  };
  const openAssetDialog = () => assetInputRef.value?.click();
</script>

<template>
  <div class="tb-wrapper" :class="{ focus: focusMode }">
    <div class="left">
      <Tabs v-model="activeIndex" :labels="['Source', 'Files']" :icons="['Code', 'Files']">
        <TabPage />
        <TabPage />
      </Tabs>
    </div>
    <div class="right">
      <transition name="fade-slide" mode="out-in">
        <div v-if="activeIndex === 0" key="source" class="source-right">
          <span class="word-count">{{ numWords }} words</span>
          <Button kind="tertiary" size="sm" icon="Settings" />
          <Button
            ref="syncBtnRef"
            kind="tertiary"
            size="sm"
            icon="ArrowBarToRight"
            aria-label="Scroll preview to cursor"
            @click="emit('sync-to-preview')"
          />
          <Tooltip :anchor="syncBtnRef?.$el ?? null" content="Scroll preview to cursor" placement="bottom" />
          <Button
            kind="primary"
            size="sm"
            :text="isCompiling ? '' : 'compile'"
            :icon="isCompiling ? 'Loader2' : ''"
            class="cta compile-btn"
            :class="{ compiling: isCompiling }"
            :disabled="isCompiling"
            @click="emit('compile')"
          />
        </div>
        <div v-else key="files" class="files-right">
          <input
            ref="assetInputRef"
            type="file"
            style="display: none"
            multiple
            @change="handleAssetSelect"
          />
          <Button kind="primary" size="sm" text="New File" class="cta" @click="openAssetDialog" />
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
  .tb-wrapper {
    --outer-padding: 8px;
    --sidebar-width: 64px;
    --links-width: 151px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    border-top-left-radius: 16px;
    background-color: v-bind(fileSettings.background);
    opacity: 1;
    transform: translateY(0);
    will-change: opacity, transform, width;
    transition:
      opacity var(--transition-duration) ease,
      transform var(--transition-duration) ease,
      width var(--transition-duration) ease;
  }

  .tabs-wrapper :deep(.tabs-header) {
    border-radius: 8px 8px 0 0 !important;
  }

  .tabs-wrapper :deep(.tab-wrapper) {
    width: 56px;
  }

  .tabs-wrapper :deep(.tabs-content) {
    display: none !important;
    padding: 0px !important;
    margin: 0px !important;
  }

  .word-count {
    font-size: 13px;
    font-weight: 400;
    color: var(--gray-600);
    letter-spacing: 0.01em;
    text-wrap: nowrap;
    padding-inline: 16px;
  }

  .source-right,
  .files-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .right {
    position: relative;
    height: 32px;
  }

  .fade-slide-enter-active,
  .fade-slide-leave-active {
    position: absolute;
    right: 0;
    transition: all 0.3s ease-out;
  }

  .fade-slide-enter-from {
    opacity: 0;
    transform: translateX(16px);
  }

  .fade-slide-leave-to {
    opacity: 0;
    transform: translateX(-16px);
  }

  .fade-slide-enter-to,
  .fade-slide-leave-from {
    opacity: 1;
    transform: translateX(0);
  }

  .compile-btn {
    min-width: 86px;
    justify-content: center;
  }

  .compile-btn.compiling :deep(.tabler-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
