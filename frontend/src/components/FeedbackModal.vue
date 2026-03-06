<script setup>
  import { ref, inject, watch, nextTick, useTemplateRef } from "vue";
  import toast from "@/utils/toast.js";

  const props = defineProps({
    show: { type: Boolean, default: false },
  });

  const emit = defineEmits(["close"]);
  const api = inject("api");
  const textareaRef = useTemplateRef("textarea-ref");

  const message = ref("");
  const submitting = ref(false);
  const charCount = ref(0);
  const MAX_CHARS = 2000;

  watch(
    () => props.show,
    async (val) => {
      if (val) {
        message.value = "";
        charCount.value = 0;
        await nextTick();
        textareaRef.value?.focus();
      }
    }
  );

  const onInput = () => {
    charCount.value = message.value.length;
  };

  const submit = async () => {
    const trimmed = message.value.trim();
    if (!trimmed || submitting.value) return;

    submitting.value = true;
    try {
      await api.post("/feedback", { message: trimmed });
      toast.success("Thanks for your feedback!");
      emit("close");
    } catch {
      toast.error("Could not send feedback. Please try again.");
    } finally {
      submitting.value = false;
    }
  };
</script>

<template>
  <Modal v-if="show" data-testid="feedback-modal" @close="$emit('close')">
    <template #header>
      <div class="feedback-header" @click.stop>
        <Icon name="MessageChatbot" class="header-icon" />
        <span>Feedback</span>
      </div>
    </template>

    <div class="feedback-body" @click.stop>
      <p class="feedback-description">
        Let us know what's working, what isn't, or what you'd like to see.
      </p>

      <form @submit.prevent="submit">
        <div class="textarea-wrapper" :class="{ focused: false }">
          <textarea
            ref="textarea-ref"
            v-model="message"
            class="feedback-textarea"
            placeholder="I wish this app would..."
            rows="4"
            :maxlength="MAX_CHARS"
            data-testid="feedback-textarea"
            @input="onInput"
            @keydown.meta.enter.prevent="submit"
          ></textarea>
          <span
            v-if="charCount > 0"
            class="char-count"
            :class="{ near: charCount > MAX_CHARS * 0.9 }"
          >
            {{ charCount }}/{{ MAX_CHARS }}
          </span>
        </div>

        <div class="actions">
          <Button kind="tertiary" text="Cancel" @click="$emit('close')" />
          <Button
            kind="primary"
            text="Send feedback"
            icon="Send2"
            :disabled="!message.trim() || submitting"
            data-testid="feedback-submit"
            @click="submit"
          />
        </div>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
  .feedback-header {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .feedback-header :deep(.tabler-icon) {
    color: var(--primary-600);
    width: 20px;
    height: 20px;
  }

  .feedback-body {
    padding-top: 0;
  }

  .feedback-description {
    margin: 0 0 16px;
    font-size: 14px;
    color: var(--dark);
    line-height: var(--body-line-height);
  }

  .textarea-wrapper {
    position: relative;
  }

  .feedback-textarea {
    width: 100%;
    padding: 12px;
    border: var(--border-extrathin) solid var(--border-primary);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    line-height: var(--body-line-height);
    resize: vertical;
    min-height: 100px;
    outline: none;
    background: var(--surface-page);
    color: var(--extra-dark);
    transition: var(--transition-bd-color);
  }

  .feedback-textarea:focus {
    border-color: var(--border-action);
  }

  .feedback-textarea::placeholder {
    color: var(--medium);
  }

  .char-count {
    position: absolute;
    bottom: 8px;
    right: 12px;
    font-size: 12px;
    color: var(--medium);
    pointer-events: none;
  }

  .char-count.near {
    color: var(--warning-600);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
    padding-bottom: 4px;
  }
</style>
