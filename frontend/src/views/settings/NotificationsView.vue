<script setup>
  import { ref, reactive, onMounted, inject } from "vue";
  import { IconShield } from "@tabler/icons-vue";

  const api = inject("api");

  const settings = reactive({
    allowAnonymousFeedback: false,
    emailDigestFrequency: "weekly",
    notificationPreference: "in-app",
    notificationMentions: true,
    notificationComments: true,
    notificationShares: true,
    notificationSystem: true,
  });

  const loading = ref(false);
  const saved = ref(false);

  onMounted(async () => {
    try {
      const response = await api.get("/user-settings");
      Object.assign(settings, response.data);
    } catch (error) {
      console.error("Failed to load user settings:", error);
    }
  });

  const saveSettings = async () => {
    loading.value = true;
    saved.value = false;

    try {
      await api.post("/user-settings", settings);
      saved.value = true;
      setTimeout(() => {
        saved.value = false;
      }, 2000);
    } catch (error) {
      console.error("Failed to save user settings:", error);
    } finally {
      loading.value = false;
    }
  };
</script>

<template>
  <Pane>
    <template #header>
      <IconShield />
      <h3>Notifications</h3>
    </template>

    <Section>
      <template #title>Notification Delivery</template>
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
      </template>
    </Section>

    <Section>
      <template #title>Notification Types</template>
      <template #content>
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
      </template>
    </Section>

    <Section>
      <template #title>Email Preferences</template>
      <template #content>
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

    <div class="settings-actions">
      <Button :disabled="loading" kind="primary" :class="{ saved: saved }" @click="saveSettings">
        {{ loading ? "Saving..." : saved ? "Saved!" : "Save Settings" }}
      </Button>
    </div>
  </Pane>
</template>

<style scoped>
  :deep(.section) {
    width: 100%;
  }

  .setting-item {
    margin-bottom: 16px;
  }

  .setting-item label {
    display: block;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
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
    color: var(--text-secondary);
    font-size: 13px;
    margin: 4px 0 0 0;
  }

  select {
    padding: 8px 12px;
    border: var(--border-thin) solid var(--border-subtle);
    border-radius: 6px;
    background: var(--surface-page);
    color: var(--text-primary);
    font-size: 14px;
  }

  select:focus {
    outline: none;
    border-color: var(--accent-500);
  }

  .settings-actions {
    margin-top: 16px;
  }

  .saved {
    background: var(--green-600, #16a34a) !important;
    border-color: var(--green-600, #16a34a) !important;
  }
</style>
