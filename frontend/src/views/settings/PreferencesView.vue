<script setup>
  import { ref, reactive, computed, onMounted, onUnmounted, watch, inject } from "vue";
  import { onBeforeRouteLeave } from "vue-router";
  import { IconSettings2 } from "@tabler/icons-vue";
  import { toast } from "@/utils/toast.js";
  import SelectBox from "@/components/forms/SelectBox.vue";

  const api = inject("api");

  const autoSaveOptions = [
    { value: 10, label: "10 seconds" },
    { value: 30, label: "30 seconds" },
    { value: 60, label: "1 minute" },
    { value: 300, label: "5 minutes" },
  ];

  const autoCompileOptions = [
    { value: 500, label: "500ms" },
    { value: 1000, label: "1 second" },
    { value: 2000, label: "2 seconds" },
    { value: 5000, label: "5 seconds" },
  ];

  const notificationMethodOptions = [
    { value: "in-app", label: "In-app only" },
    { value: "email", label: "Email only" },
    { value: "both", label: "Both in-app and email" },
  ];

  const emailDigestOptions = [
    { value: "none", label: "Never" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
  ];

  const mobileMenuOptions = [
    { value: "standard", label: "Standard" },
    { value: "compact", label: "Compact" },
    { value: "minimal", label: "Minimal" },
  ];

  const defaults = {
    autoSaveInterval: 30,
    autoCompileDelay: 1000,
    focusModeAutoHide: true,
    sidebarAutoCollapse: false,
    drawerDefaultAnnotations: false,
    drawerDefaultMargins: false,
    drawerDefaultSettings: false,
    notificationPreference: "in-app",
    notificationMentions: true,
    notificationComments: true,
    notificationShares: true,
    notificationSystem: true,
    emailDigestFrequency: "weekly",
    allowAnonymousFeedback: false,
    soundNotifications: true,
    mobileMenuBehavior: "standard",
  };

  const settings = reactive({ ...defaults });
  const savedSettings = ref({ ...defaults });
  const loading = ref(false);
  const saved = ref(false);

  const hasUnsavedChanges = computed(() => {
    const saved_ = savedSettings.value;
    return Object.keys(defaults).some((key) => settings[key] !== saved_[key]);
  });

  const handleBeforeUnload = (e) => {
    if (hasUnsavedChanges.value) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  };

  watch(hasUnsavedChanges, (hasChanges) => {
    if (hasChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  });

  const resetSettings = () => {
    Object.assign(settings, savedSettings.value);
    toast.info("Changes discarded");
  };

  onMounted(async () => {
    try {
      const response = await api.get("/user-settings");
      Object.assign(settings, response.data);
      savedSettings.value = { ...settings };
    } catch (error) {
      console.error("Failed to load user settings:", error);
      toast.error("Failed to load preferences", {
        description: "Your default settings are being used. Please try refreshing the page.",
      });
    }
  });

  onBeforeRouteLeave(() => {
    if (hasUnsavedChanges.value) {
      const leave = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!leave) return false;
    }
  });

  onUnmounted(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  const saveSettings = async () => {
    loading.value = true;
    saved.value = false;

    try {
      await api.post("/user-settings", settings);
      savedSettings.value = { ...settings };
      saved.value = true;
      setTimeout(() => {
        saved.value = false;
      }, 2000);
    } catch (error) {
      console.error("Failed to save user settings:", error);
      toast.error("Failed to save preferences", {
        description: "Please check your connection and try again.",
      });
    } finally {
      loading.value = false;
    }
  };
</script>

<template>
  <Pane>
    <template #header>
      <IconSettings2 />
      <h1>Preferences</h1>
    </template>

    <Section variant="enhanced">
      <template #title>Auto-save & Performance</template>
      <template #content>
        <div class="setting-item">
          <SelectBox
            v-model="settings.autoSaveInterval"
            label="Auto-save interval"
            :options="autoSaveOptions"
          />
        </div>

        <div class="setting-item">
          <SelectBox
            v-model="settings.autoCompileDelay"
            label="Auto-compile delay"
            :options="autoCompileOptions"
          />
        </div>
      </template>
    </Section>

    <Section variant="enhanced">
      <template #title>Editor</template>
      <template #content>
        <div class="setting-item">
          <Checkbox id="focus-mode-auto-hide" v-model="settings.focusModeAutoHide">
            Auto-hide UI elements in focus mode
          </Checkbox>
          <p class="setting-description">
            Automatically hide navigation and toolbars when entering focus mode
          </p>
        </div>

        <div class="setting-item">
          <Checkbox id="sidebar-auto-collapse" v-model="settings.sidebarAutoCollapse">
            Auto-collapse sidebar
          </Checkbox>
          <p class="setting-description">Automatically collapse the sidebar when not in use</p>
        </div>

        <p class="setting-description">Set the default open/closed state for workspace drawers</p>

        <div class="setting-item">
          <Checkbox id="drawer-annotations" v-model="settings.drawerDefaultAnnotations">
            Open annotations drawer by default
          </Checkbox>
        </div>

        <div class="setting-item">
          <Checkbox id="drawer-margins" v-model="settings.drawerDefaultMargins">
            Open margins drawer by default
          </Checkbox>
        </div>

        <div class="setting-item">
          <Checkbox id="drawer-settings" v-model="settings.drawerDefaultSettings">
            Open settings drawer by default
          </Checkbox>
        </div>
      </template>
    </Section>

    <Section variant="enhanced">
      <template #title>Notifications</template>
      <template #content>
        <div class="setting-item">
          <SelectBox
            v-model="settings.notificationPreference"
            label="Notification method"
            :options="notificationMethodOptions"
          />
          <p class="setting-description">
            Choose how you want to receive notifications about activity on your content
          </p>
        </div>

        <p class="setting-description">
          Choose which types of activities you want to be notified about
        </p>

        <div class="setting-item">
          <Checkbox id="notification-mentions" v-model="settings.notificationMentions">
            Mentions
          </Checkbox>
          <p class="setting-description">When someone mentions you in a comment or annotation</p>
        </div>

        <div class="setting-item">
          <Checkbox id="notification-comments" v-model="settings.notificationComments">
            Comments
          </Checkbox>
          <p class="setting-description">
            When someone comments on your content or in a shared workspace
          </p>
        </div>

        <div class="setting-item">
          <Checkbox id="notification-shares" v-model="settings.notificationShares">
            Shares and collaboration invites
          </Checkbox>
          <p class="setting-description">
            When someone shares content with you or invites you to collaborate
          </p>
        </div>

        <div class="setting-item">
          <Checkbox id="notification-system" v-model="settings.notificationSystem">
            System updates
          </Checkbox>
          <p class="setting-description">
            Important updates about new features, maintenance, and security notices
          </p>
        </div>

        <div class="setting-item">
          <SelectBox
            v-model="settings.emailDigestFrequency"
            label="Email digest frequency"
            :options="emailDigestOptions"
          />
          <p class="setting-description">
            How often you'd like to receive summary emails about your account activity
          </p>
        </div>
      </template>
    </Section>

    <Section variant="enhanced">
      <template #title>Interaction & Privacy</template>
      <template #content>
        <div class="setting-item">
          <Checkbox id="anonymous-feedback" v-model="settings.allowAnonymousFeedback">
            Allow anonymous feedback and comments
          </Checkbox>
          <p class="setting-description">
            Allow viewers to leave feedback on your public content without requiring them to sign in
          </p>
        </div>

        <div class="setting-item">
          <Checkbox id="sound-notifications" v-model="settings.soundNotifications">
            Enable sound notifications
          </Checkbox>
          <p class="setting-description">Play audio feedback for actions and notifications</p>
        </div>
      </template>
    </Section>

    <Section variant="enhanced">
      <template #title>Mobile</template>
      <template #content>
        <div class="setting-item">
          <SelectBox
            v-model="settings.mobileMenuBehavior"
            label="Mobile menu behavior"
            :options="mobileMenuOptions"
          />
        </div>
      </template>
    </Section>

    <div class="settings-actions">
      <Button kind="tertiary" :disabled="loading || !hasUnsavedChanges" @click="resetSettings">
        Reset
      </Button>
      <Button
        :disabled="loading"
        kind="primary"
        :class="{ saved: saved }"
        data-testid="save-settings-button"
        @click="saveSettings"
      >
        {{ loading ? "Saving..." : saved ? "Saved!" : "Save Settings" }}
      </Button>

      <div v-if="hasUnsavedChanges" class="status-message warning" role="status" aria-live="polite">
        <Icon name="AlertCircle" size="16" />
        <span>You have unsaved changes</span>
      </div>
    </div>
  </Pane>
</template>

<style scoped>
  .setting-item {
    margin-bottom: 16px;
  }

  .setting-description {
    color: var(--gray-500);
    font-size: 13px;
    margin: 4px 0 0 0;
  }

  .settings-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
  }

  .saved {
    background: var(--green-600, #16a34a) !important;
    border-color: var(--green-600, #16a34a) !important;
  }

  .status-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    margin-top: 16px;
  }

  .status-message.warning {
    background-color: var(--surface-warning);
    border: var(--border-thin) solid var(--border-warning);
    color: var(--warning-700);
  }

  .status-message :deep(.tabler-icon) {
    flex-shrink: 0;
  }

  .status-message.warning :deep(.tabler-icon) {
    color: var(--warning-600);
  }
</style>
