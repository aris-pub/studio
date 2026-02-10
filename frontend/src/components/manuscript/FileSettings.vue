<script setup>
  import { computed, ref, onMounted } from "vue";

  const props = defineProps({
    header: { type: Boolean, default: true },
  });
  const emit = defineEmits(["save"]);
  const settingsObj = defineModel({ type: Object, required: true });

  // All available options
  const bgColors = {
    white: "var(--surface-page)",
    gray: "var(--gray-75)",
    orange: "var(--orange-50)",
    green: "var(--green-50)",
  };
  const fontSizeOptions = ["14px", "16px", "18px"];
  const lineHeightOptions = ["1.2", "1.5", "1.8"];
  const fontFamilyOptions = ["'Source Sans 3', sans-serif", "'Source Serif 4', serif"];
  const marginWidthOptions = ["0px", "16px", "64px"];

  // Sync settingsObj with the UI: some via simple watchers and some via computed
  // properties for two-way binding between indices and v-models
  const onChangeBackground = (color) => {
    settingsObj.value.background = bgColors[color];
  };
  const fontSize = computed({
    get: () => fontSizeOptions.indexOf(settingsObj.value?.fontSize),
    set: (index) => {
      if (index >= 0 && index < fontSizeOptions.length) {
        settingsObj.value.fontSize = fontSizeOptions[index];
      }
    },
  });
  const lineHeight = computed({
    get: () => lineHeightOptions.indexOf(settingsObj.value?.lineHeight),
    set: (index) => {
      if (index >= 0 && index < lineHeightOptions.length) {
        settingsObj.value.lineHeight = lineHeightOptions[index];
      }
    },
  });
  const fontFamily = computed({
    get: () => fontFamilyOptions.indexOf(settingsObj.value?.fontFamily),
    set: (index) => {
      if (index >= 0 && index < fontFamilyOptions.length) {
        settingsObj.value.fontFamily = fontFamilyOptions[index];
      }
    },
  });
  const marginWidth = computed({
    get: () => marginWidthOptions.indexOf(settingsObj.value?.marginWidth),
    set: (index) => {
      if (index >= 0 && index < marginWidthOptions.length) {
        settingsObj.value.marginWidth = marginWidthOptions[index];
      }
    },
  });

  // Reset to the initial settings
  const onReset = () => {
    if (!initialSettings.value) return;
    Object.assign(settingsObj.value, initialSettings.value);
  };

  const initialSettings = ref(null);
  const startReceivingUserInput = () => {
    if (!settingsObj.value || !Object.keys(settingsObj.value).length > 0) return;
    initialSettings.value = JSON.parse(JSON.stringify(settingsObj.value));
  };
  defineExpose({ startReceivingUserInput });
  onMounted(startReceivingUserInput);
</script>

<template>
  <div class="settings">
    <header v-if="header" class="settings-header">File Settings</header>
    <Section>
      <template #title>Colors</template>
      <template #content>
        <div class="row theme">
          <span class="label">Theme</span>
          <span class="control">
            <ThemeSwitch :labels="true" />
          </span>
        </div>
        <div class="column bg">
          <span class="label">Background</span>
          <span class="control">
            <ColorPicker :colors="bgColors" @change="onChangeBackground" />
          </span>
        </div>
      </template>
    </Section>

    <Section>
      <template #title>Font</template>
      <template #content>
        <div class="row size">
          <span class="label">Size</span>
          <span class="control">
            <SegmentedControl
              v-model="fontSize"
              :icons="['TextDecrease', 'LetterA', 'TextIncrease']"
              :labels="['small', 'normal', 'large']"
              :tooltips="['base size: 14px', 'base size: 16px', 'base size: 18px']"
              :default-active="fontSize"
            />
          </span>
        </div>
        <div class="row">
          <span class="label">Density</span>
          <span class="control">
            <SegmentedControl
              v-model="lineHeight"
              :labels="['tight', 'normal', 'roomy']"
              :icons="['BaselineDensitySmall', 'BaselineDensityMedium', 'BaselineDensityLarge']"
              :tooltips="['line height: 1.2', 'line height: 1.5', 'line height: 1.8']"
              :default-active="lineHeight"
            />
          </span>
        </div>
        <div class="row style">
          <span class="label">Style</span>
          <span class="control">
            <SegmentedControl
              v-model="fontFamily"
              :labels="['Sans', 'Serif']"
              :tooltips="['Source Sans 3', 'Charter']"
              :default-active="fontFamily"
            />
          </span>
        </div>
      </template>
    </Section>

    <Section>
      <template #title>Layout</template>
      <template #content>
        <div class="row">
          <span class="label">Width</span>
          <span class="control">
            <SegmentedControl
              v-model="marginWidth"
              :labels="['narrow', 'normal', 'wide']"
              :icons="['ViewportNarrow', 'Crop11', 'ViewportWide']"
              :tooltips="['wide margins', 'normal margins', 'no normal']"
              :default-active="marginWidth"
            />
          </span>
        </div>
      </template>
    </Section>
    <div class="buttons">
      <Button kind="tertiary" text="Reset" data-testid="reset-button" @click="onReset" />
      <Button
        class="cta"
        kind="primary"
        text="Save Settings"
        data-testid="save-button"
        @click="emit('save', settingsObj)"
      />
    </div>
  </div>
</template>

<style scoped>
  .settings {
    display: flex;
    flex-direction: column;
  }

  .settings-header {
    padding: 16px;
    font-weight: 600;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-bottom: 16px;

    & > button {
      padding-inline: 16px;
    }

    & > .cta {
      padding-inline: 48px;
      background-color: var(--surface-action);
      border-color: var(--border-action);
    }
  }

  .row {
    display: flex;
    justify-content: flex-start;
    gap: 8px;
    align-items: center;

    & .label {
      text-align: left;
      width: 48px;
    }

    & .control {
      flex-grow: 1;
    }
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .control {
    & :deep(.sc-btn) {
      padding-inline: 2px 8px !important;
      padding-block: 0px;
      width: 80px;
      display: flex;
      justify-content: center;
    }

    & :deep(.sc-icon) {
      flex-shrink: 0;
      margin: 6px 2px;
    }

    & :deep(.sc-btn:first-child) {
      border-radius: 8px 0 0 8px;
    }

    & :deep(.sc-btn:last-child) {
      border-radius: 0 8px 8px 0;
    }

    & :deep(.sc-label) {
      font-size: 15px;
    }

    & :deep(.cp-wrapper) {
      justify-content: space-between;
    }
  }

  .theme {
    & :deep(.sc-btn) {
      padding-inline: 2px 8px !important;
    }
  }

  :is(.bg, .accent) .label {
    width: 96px !important;
  }

  .style {
    & :deep(.sc-btn) {
      letter-spacing: 0.04em;
      height: 32px;
      padding-inline: 8px;
    }

    & :deep(.sc-item .sc-label) {
      text-transform: none;
    }

    & :deep(.sc-item:first-child .sc-label) {
      font-family: "Source Sans 3" !important;
    }

    & :deep(.sc-item:last-child .sc-label) {
      font-family: "Source Serif 4" !important;
    }
  }
</style>
