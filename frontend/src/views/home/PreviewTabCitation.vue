<script setup>
  import { ref, computed, inject, onMounted } from "vue";

  // Get file from home context
  const file = inject("file");

  // Citation format state
  const activeFormat = ref("APA");
  const formatOptions = ["APA", "BibTeX", "Chicago", "MLA"];

  // Copy functionality
  const copySuccess = ref(false);

  // Computed citation data
  const citationData = computed(() => {
    if (!file?.value) return null;

    const fileData = file.value;
    const pubYear = fileData.published_at
      ? new Date(fileData.published_at).getFullYear()
      : new Date().getFullYear();

    const authors = fileData.authors || "Unknown Author";
    const title = fileData.title || "Untitled";
    const url = ""; // Publication URLs will be handled by separate publishing app

    return {
      title,
      authors,
      pubYear,
      url,
      abstract: fileData.abstract || "",
      keywords: fileData.keywords || "",
      uuid: fileData.public_uuid || "",
      formats: {
        apa: `${authors} (${pubYear}). ${title}. Aris Preprint. ${url}`,
        bibtex: `@article{${fileData.public_uuid || "unknown"},
  title={${title}},
  author={${authors}},
  year={${pubYear}},
  journal={Aris Preprint},
  url={${url}},
  abstract={${fileData.abstract || ""}},
  keywords={${fileData.keywords || ""}}
}`,
        chicago: `${authors}. "${title}." Aris Preprint ${fileData.public_uuid || ""} (${pubYear}). ${url}.`,
        mla: `${authors}. "${title}." Aris Preprint, ${pubYear}, ${url}.`,
      },
    };
  });

  // Current citation format
  const currentCitation = computed(() => {
    if (!citationData.value) return "";
    return citationData.value.formats[activeFormat.value.toLowerCase()] || "";
  });

  // Handle format change
  const handleFormatChange = (index) => {
    activeFormat.value = formatOptions[index];
  };

  // Copy citation to clipboard
  const copyCitation = async () => {
    if (!currentCitation.value) return;

    try {
      await navigator.clipboard.writeText(currentCitation.value);
      copySuccess.value = true;
      setTimeout(() => {
        copySuccess.value = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy citation:", err);
    }
  };

  // Download BibTeX
  const downloadBibTeX = () => {
    if (!citationData.value) return;

    const content = citationData.value.formats.bibtex;
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${citationData.value.uuid || "citation"}.bib`;
    link.click();
    window.URL.revokeObjectURL(url);
  };
</script>

<template>
  <div class="citation-preview">
    <div v-if="!citationData" class="empty-state">
      <Icon name="Quote" class="empty-icon" />
      <p>Citation will be available after publishing</p>
    </div>

    <div v-else class="citation-content">
      <!-- Format selector -->
      <div class="format-selector">
        <SegmentedControl
          :labels="formatOptions"
          :default-active="0"
          @change="handleFormatChange"
        />
      </div>

      <!-- Citation display -->
      <div class="citation-display">
        <div class="citation-text" :class="{ 'bibtex-format': activeFormat === 'BibTeX' }">
          {{ currentCitation }}
        </div>

        <!-- Action buttons -->
        <div class="citation-actions">
          <Button
            :icon="copySuccess ? 'Check' : 'Copy'"
            size="sm"
            kind="secondary"
            :class="{ 'copy-success': copySuccess }"
            @click="copyCitation"
          >
            {{ copySuccess ? "Copied!" : "Copy" }}
          </Button>

          <Button
            v-if="activeFormat === 'BibTeX'"
            icon="Download"
            size="sm"
            kind="secondary"
            @click="downloadBibTeX"
          >
            Download
          </Button>
        </div>
      </div>

      <!-- Publication info -->
      <div class="publication-info">
        <div class="info-item">
          <Icon name="User" class="info-icon" />
          <span>{{ citationData.authors }}</span>
        </div>
        <div class="info-item">
          <Icon name="Calendar" class="info-icon" />
          <span>{{ citationData.pubYear }}</span>
        </div>
        <div class="info-item">
          <Icon name="Hash" class="info-icon" />
          <span>{{ citationData.uuid || "Not assigned" }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .citation-preview {
    padding: 20px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--gray-500);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: var(--gray-400);
  }

  .citation-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1;
  }

  .format-selector {
    display: flex;
    justify-content: center;
  }

  .citation-display {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
  }

  .citation-text {
    background: var(--gray-50);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 16px;
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1.5;
    color: var(--gray-900);
    min-height: 80px;
    white-space: pre-wrap;
    word-wrap: break-word;
    flex: 1;
  }

  .citation-text.bibtex-format {
    font-size: 13px;
    line-height: 1.4;
  }

  .citation-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .copy-success {
    color: var(--green-600) !important;
  }

  .publication-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border-primary);
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--gray-700);
  }

  .info-icon {
    color: var(--gray-500);
    font-size: 16px;
  }
</style>
