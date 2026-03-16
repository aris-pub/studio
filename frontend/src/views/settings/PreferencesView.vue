<script setup>
  import { ref, reactive, computed, onMounted, onUnmounted, watch, inject } from "vue";
  import { IconSettings2 } from "@tabler/icons-vue";
  import { toast } from "@/utils/toast.js";

  const api = inject("api");

  const settings = reactive({
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
  });

  const savedSettings = ref({});
  const loading = ref(false);
  const saved = ref(false);

  const hasUnsavedChanges = computed(() => {
    const keys = Object.keys(savedSettings.value);
    if (keys.length === 0) return false;
    return keys.some((key) => settings[key] !== savedSettings.value[key]);
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

  onMounted(async () => {
    try {
      const response = await api.get("/user-settings");
      Object.assign(settings, response.data);
    } catch (error) {
      console.error("Failed to load user settings:", error);
      toast.error("Failed to load preferences", {
        description: "Your default settings are being used. Please try refreshing the page.",
      });
    }
    savedSettings.value = { ...settings };
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
          <label for="auto-save-interval">Auto-save interval (seconds)</label>
          <select id="auto-save-interval" v-model="settings.autoSaveInterval">
            <option :value="10">10 seconds</option>
            <option :value="30">30 seconds</option>
            <option :value="60">1 minute</option>
            <option :value="300">5 minutes</option>
          </select>
        </div>

        <div class="setting-item">
          <label for="auto-compile-delay">Auto-compile delay (milliseconds)</label>
          <select id="auto-compile-delay" v-model="settings.autoCompileDelay">
            <option :value="500">500ms</option>
            <option :value="1000">1 second</option>
            <option :value="2000">2 seconds</option>
            <option :value="5000">5 seconds</option>
          </select>
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
          <label for="notification-preference">Notification method</label>
          <select id="notification-preference" v-model="settings.notificationPreference">
            <option value="in-app">In-app only</option>
            <option value="email">Email only</option>
            <option value="both">Both in-app and email</option>
          </select>
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
          <label for="email-digest">Email digest frequency</label>
          <select id="email-digest" v-model="settings.emailDigestFrequency">
            <option value="none">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
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
          <label for="mobile-menu-behavior">Mobile menu behavior</label>
          <select id="mobile-menu-behavior" v-model="settings.mobileMenuBehavior">
            <option value="standard">Standard</option>
            <option value="compact">Compact</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>
      </template>
    </Section>

    <div class="settings-actions">
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

  .setting-item label {
    display: block;
    font-weight: var(--weight-medium, 500);
    color: var(--gray-900);
    margin-bottom: 6px;
    font-size: 14px;
  }

  .checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .checkbox-wrapper label {
    margin: 0;
    cursor: pointer;
  }

  .checkbox-wrapper input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
  }

  .setting-description {
    color: var(--gray-500);
    font-size: 13px;
    margin: 4px 0 0 0;
  }

  select {
    width: 100%;
    height: 40px;
    padding: 8px 36px 8px 12px;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 8px;
    background-color: transparent;
    color: var(--gray-900);
    font-size: 14px;
    font-family: inherit;
    line-height: 1.4;
    cursor: pointer;
    transition: var(--transition-bg-color), var(--transition-bd-color);
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 16px;
  }

  select:hover {
    border-color: var(--gray-400);
    background-color: var(--gray-50);
  }

  select:focus {
    outline: var(--border-med) solid var(--border-action);
    outline-offset: var(--border-extrathin);
    border-color: var(--border-action);
    background-color: var(--white);
  }

  select:disabled {
    background-color: var(--surface-disabled);
    color: var(--gray-400);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .settings-actions {
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
