<script setup>
  import { ref, reactive, computed, inject, onMounted } from "vue";
  import { IconQuote, IconUserEdit, IconCalendar, IconBook2 } from "@tabler/icons-vue";

  // Get file from workspace context
  const file = inject("file");

  // Citation format state
  const activeFormat = ref("Plain");
  const copySuccess = ref(false);

  // Computed citation data
  const sectionData = computed(() => {
    if (!file?.value) return [];

    const fileData = file.value;
    const publishedDate = fileData.published_at
      ? new Date(fileData.published_at).toLocaleDateString()
      : "Not published";

    // Generate citation formats
    const plainCitation = `${fileData.title || "Untitled"} by ${fileData.authors || "Unknown Author"}. Published on Aris Preprint, ${publishedDate}. ${fileData.public_uuid || ""}`;

    const bibtexCitation = `@article{${fileData.public_uuid || "unknown"},
  title={${fileData.title || "Untitled"}},
  author={${fileData.authors || "Unknown Author"}},
  year={${fileData.published_at ? new Date(fileData.published_at).getFullYear() : new Date().getFullYear()}},
  journal={Aris Preprint},
  url={}, % Publication URLs will be handled by separate publishing app
  abstract={${fileData.abstract || ""}},
  keywords={${fileData.keywords || ""}}
}`;

    return [
      {
        label: "Reference",
        icon: IconQuote,
        content: activeFormat.value === "Plain" ? plainCitation : bibtexCitation,
      },
      {
        label: "Author",
        icon: IconUserEdit,
        content: fileData.authors || "Unknown Author",
      },
      {
        label: "Source",
        icon: IconBook2,
        content: `📝 Aris Preprint
        🔗 UUID: ${fileData.public_uuid || "Not assigned"}
        📅 ${new Date(fileData.published_at || Date.now()).getFullYear()}`,
      },
      {
        label: "Date",
        icon: IconCalendar,
        content: fileData.published_at
          ? `📅 Published: ${new Date(fileData.published_at).toLocaleDateString()}`
          : "📝 Draft (Not published)",
      },
    ];
  });

  // Handle format change
  const handleFormatChange = (format) => {
    activeFormat.value = format;
  };

  // Copy citation to clipboard
  const copyCitation = async () => {
    const citation = sectionData.value[0]?.content;
    if (!citation) return;

    try {
      await navigator.clipboard.writeText(citation);
      copySuccess.value = true;
      setTimeout(() => {
        copySuccess.value = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy citation:", err);
    }
  };
</script>

<template>
  <div class="citation">
    <div v-for="obj in sectionData" :key="obj" :class="['sec', obj.label.toLowerCase()]">
      <div class="sec-title text-label">
        <div class="left">
          <span class="sec-title-icon"><component :is="obj.icon" /></span>
          <span class="sec-title-label">{{ obj.label }}</span>
        </div>
        <div class="right">
          <SegmentedControl
            v-if="obj.label === 'Reference'"
            :labels="['Plain', 'BibTex']"
            :default-active="0"
            @change="(index) => handleFormatChange(index === 0 ? 'Plain' : 'BibTex')"
          />
          <Button
            kind="tertiary"
            :icon="copySuccess ? 'Check' : 'Clipboard'"
            size="sm"
            :class="{ 'copy-success': copySuccess }"
            @click="copyCitation"
          />
        </div>
      </div>
      <div class="sec-content">
        <p>{{ obj.content || "" }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .citation {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sec {
  }

  .sec.reference .sec-title .right :deep(.sc-wrapper .sc-btn) {
    padding-block: 0;
  }

  .sec-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: var(--border-thin) solid var(--border-information);
    margin-bottom: 8px;
  }

  .sec-title .left {
    display: flex;
    gap: 8px;
  }

  .sec-title .right {
    display: flex;
    gap: 8px;
  }

  .sec-title-icon .tabler-icon {
    margin: 0;
  }

  .sec-content {
  }

  .copy-success {
    color: var(--green-600) !important;
  }
</style>
