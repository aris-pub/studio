<script setup>
  import { ref, reactive, inject, provide, computed, onMounted, useTemplateRef } from "vue";
  import { IconInfoCircle, IconFileText } from "@tabler/icons-vue";
  import { File } from "@/models/File.js";

  const user = inject("user");
  const api = inject("api");

  const file = ref(
    new File(
      {
        id: null,
        title: "Sample Title",
        last_edited_at: new Date().toISOString(),
        tags: [],
        minimap: null,
        ownerId: user.id,
        selected: false,
        filtered: false,
        isMountedAt: null,
        html: "",
        source: `# File Settings Preview

:author:
:name: ${user.value.name}
:email: ${user.value.email}
::

## Sample Section Heading
:label: sec

Aris\\: the web-native, human-first ResOps platform.

### And a subsection

Lorem ipsum.

:remark:
Insightful remark goes here, with a reference to the earlier :ref:sec::.
::`,
      },
      null
    )
  );

  let defaultSettings = reactive({});
  const fileSettingsRef = useTemplateRef("file-settings-ref");

  onMounted(async () => {
    try {
      const fromDb = await File.getSettings(file.value, api);
      Object.assign(defaultSettings, fromDb);
      fileSettingsRef.value.startReceivingUserInput();
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  });

  provide("file", file);

  onMounted(async () => {
    try {
      const response = await api.post("render", { source: file.value.source });
      file.value.html = response.data;
    } catch (error) {
      console.error("Failed to render content:", error);
    }
  });

  const onSave = async (settingsObj) => {
    try {
      await File.updateDefaultSettings(settingsObj, api);
    } catch (error) {
      console.error("Failed trying to update default settings.");
      console.error(error);
    }
  };
</script>

<template>
  <Pane>
    <template #header>
      <IconFileText />
      <h3>Document Display</h3>
    </template>

    <div class="settings-main">
      <div class="settings-controls">
        <Section>
          <template #title>Display Settings</template>
          <template #content>
            <FileSettings
              ref="file-settings-ref"
              v-model="defaultSettings"
              :header="false"
              @save="onSave"
            />
          </template>
        </Section>

        <Section>
          <template #content>
            <div class="info">
              <IconInfoCircle />
              <p>
                These settings will be applied to <em>new</em> files. Modify the settings of
                <em>existing</em> files by opening them and choosing the Settings option in the
                sidebar.
              </p>
            </div>
          </template>
        </Section>
      </div>
      <div class="settings-preview">
        <ManuscriptWrapper
          :html-string="file?.html || ''"
          :keys="false"
          :settings="defaultSettings"
        />
      </div>
    </div>
  </Pane>
</template>

<style scoped>
  .settings-main {
    display: flex;
    flex-direction: row;
    gap: 24px;
  }

  .settings-controls {
    width: 324px;
    flex-shrink: 0;
  }

  .settings-preview {
    flex: 1;
    min-width: 0;
  }

  .info {
    display: flex;
    align-items: center;
    padding-block: 16px;
    padding-inline: 8px;
    background-color: var(--surface-information);
    border: var(--border-thin) solid var(--border-information);
    border-radius: 8px;
    margin-top: 16px;

    & .tabler-icon {
      flex-shrink: 0;
      color: var(--icon-information);
    }

    & p {
      padding-inline: 8px;
      font-size: 14px;
      color: var(--information-700);
    }
  }

  .rsm-manuscript {
    box-shadow: var(--shadow-soft);
    padding-block: 16px;
    border-radius: 8px;
    height: 100%;
  }

  :deep(.manuscriptwrapper) {
    padding-bottom: 0 !important;
  }
</style>
