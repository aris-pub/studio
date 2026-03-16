<script setup>
  import { ref, computed, onUnmounted, watch } from "vue";
  import ProfileSection from "./ProfileSection.vue";
  import SecuritySection from "./SecuritySection.vue";
  import DataManagementSection from "./DataManagementSection.vue";
  import DangerZone from "./DangerZone.vue";

  const profileRef = ref(null);
  const securityRef = ref(null);

  const hasAnyUnsavedChanges = computed(
    () => profileRef.value?.hasUnsavedChanges || securityRef.value?.hasUnsavedChanges
  );

  const handleBeforeUnload = (e) => {
    if (hasAnyUnsavedChanges.value) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  };

  watch(hasAnyUnsavedChanges, (hasChanges) => {
    if (hasChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  });
</script>

<template>
  <BaseLayout :fab="false">
    <Pane>
      <template #header>
        <Icon name="User" />
        <span class="title">Account</span>
      </template>

      <ProfileSection ref="profileRef" />
      <SecuritySection ref="securityRef" />
      <DataManagementSection />
      <DangerZone />
    </Pane>
  </BaseLayout>
</template>

<style scoped>
  .title {
    margin-left: 8px;
    font-weight: var(--weight-medium);
  }

  :deep(.tabler-icon-loader-2) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
