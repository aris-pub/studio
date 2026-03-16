<script setup>
  import { ref, inject } from "vue";
  import { toast } from "@/utils/toast.js";
  import { sanitizeFilename } from "@/utils/download.js";

  const user = inject("user");
  const api = inject("api");

  const isExporting = ref(false);

  const onExportData = async () => {
    if (isExporting.value) return;
    isExporting.value = true;

    try {
      const response = await api.get(`/users/${user.value.id}/export`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = sanitizeFilename(user.value.name);
      link.setAttribute("download", `${safeName}-data-export.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Data export downloaded successfully");
    } catch (error) {
      console.error("Failed to export data", error);
      toast.error("Failed to export data", {
        description: "Please try again later.",
      });
    } finally {
      isExporting.value = false;
    }
  };
</script>

<template>
  <Section variant="enhanced">
    <template #title>Data Management</template>
    <template #content>
      <div class="data-action">
        <div class="action-content">
          <h3>Export Your Data</h3>
          <p>Download a copy of all your account data, research, and settings</p>
        </div>
        <Button
          kind="tertiary"
          :icon="isExporting ? 'Loader2' : 'Download'"
          :disabled="isExporting"
          @click="onExportData"
        >
          {{ isExporting ? "Exporting..." : "Export Data" }}
        </Button>
      </div>
    </template>
  </Section>
</template>

<style scoped>
  .data-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .action-content {
    flex: 1;
    min-width: 0;
  }

  .action-content h3 {
    font-size: 14px;
    font-weight: var(--weight-medium);
    color: var(--gray-900);
    margin: 0 0 4px 0;
  }

  .action-content p {
    font-size: 13px;
    color: var(--gray-600);
    margin: 0;
  }

  @media (max-width: 768px) {
    .data-action {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
