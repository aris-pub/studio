<script setup>
  import { ref, inject, computed, watch, useTemplateRef, watchEffect } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { useElementSize } from "@vueuse/core";
  import { File } from "@/models/File.js";
  import FilesPane from "./FilesPane.vue";
  import PreviewPane from "./PreviewPane.vue";

  import DragBorder from "./DragBorder.vue";
  const fileStore = inject("fileStore");
  const route = useRoute();
  const router = useRouter();

  // Handle draggable border and pane height
  const panesRef = useTemplateRef("panes-ref");
  const { height: panesHeight } = useElementSize(panesRef);
  const boxTopPixels = 16 + 48 + 16 + 40 + 56 + 6; // padding + topbar height + gap + pane header height + height of one item row + epsilon
  const borderPos = ref(0);
  const filesHeight = computed(() =>
    fileStore?.value?.selectedFile?.value?.id ? `calc(${borderPos.value}%)` : "100%"
  );
  const previewHeight = computed(() =>
    fileStore?.value?.selectedFile?.value?.id ? `calc(${100 - borderPos.value}%)` : "0%"
  );
  watch(
    () => !!fileStore?.value?.selectedFile?.value?.id,
    (hasSelection, oldValue) => {
      // Make sure borderPos is correct when transitioning from no selection to having a selection
      if (hasSelection && !oldValue) borderPos.value = (boxTopPixels / panesHeight.value) * 100;
    }
  );

  // Dragging should be instantaneous, thus we only want a transition when NOT dragging
  const borderRef = useTemplateRef("border-ref");
  const paneHeightTransition = computed(() => {
    if (!borderRef.value) return "";
    else return borderRef.value.isDragging ? "" : "height var(--transition-duration) ease";
  });

  /* Since the gap between panes is 8px but the outer padding is 16px, when the Preview
   * pane is inactive, its top edge peeks out by 8px. This hides it. */
  const previewTop = computed(() => (fileStore?.value?.selectedFile?.value?.id ? "0" : "8px"));

  // Trigger file/tag loading when navigating to home via SPA (store exists but not yet loaded)
  watchEffect(() => {
    if (fileStore.value && !fileStore.value.filesLoaded.value) {
      fileStore.value.loadFiles();
      fileStore.value.loadTags();
    }
  });

  // Recent files as context sub-items for Home
  const recentFiles = ref(["", "", ""]);
  watchEffect(() => {
    recentFiles.value = fileStore.value?.getRecentFiles(3) || ["", "", ""];
  });

  const contextSubItems = computed(() => {
    const items = [];

    recentFiles.value.forEach((file, idx) => {
      if (file) {
        items.push({
          icon: "File",
          text: file.title || "Untitled",
          tooltip: `Open "${file.title}"`,
          tooltipAlways: true,
          active: false, // TODO: Could check if current workspace file matches
          onClick: () => File.openFile(file, router),
        });
      }
    });

    return items;
  });
</script>

<template>
  <BaseLayout :context-sub-items="contextSubItems">
    <div ref="panes-ref" class="panes">
      <FilesPane :style="{ height: '100%' }" />

      <!-- <DragBorder
           ref="border-ref"
           v-model="borderPos"
           :active="!!Object.keys(fileStore.value.selectedFile).length"
           :box-top="boxTopPixels"
           :parent-height="panesHeight"
           />

           <PreviewPane
           :file="fileStore.value.selectedFile"
           :style="{ height: previewHeight, top: previewTop }"
           /> -->
    </div>
  </BaseLayout>
</template>

<style scoped>
  .panes {
    position: relative;
    flex-grow: 1;
    height: 100%;
    border-radius: 16px;
  }
</style>
