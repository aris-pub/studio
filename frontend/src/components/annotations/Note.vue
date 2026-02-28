<script setup>
  import { ref, inject, computed } from "vue";

  const props = defineProps({
    annotation: { type: Object, required: true },
  });

  const collapsed = ref(false);
  const editing = ref(false);
  const editText = ref("");
  const user = inject("user");
  const annotationActions = inject("annotationActions", null);
  const activeAnnotationId = inject("activeAnnotationId", ref(null));

  const isActive = computed(() => activeAnnotationId.value === props.annotation.id);

  const note = computed(() => {
    const msgs = props.annotation.messages?.filter((m) => !m.deleted_at);
    return msgs?.length ? msgs[0] : null;
  });

  const colorValue = computed(() => {
    const map = {
      purple: "var(--purple-300)",
      orange: "var(--orange-300)",
      green: "var(--green-300)",
      red: "var(--red-300)",
      pink: "var(--pink-300)",
      yellow: "var(--yellow-300)",
    };
    return map[props.annotation.color] || map.purple;
  });

  const timeAgo = computed(() => {
    const created = new Date(props.annotation.created_at);
    const now = new Date();
    const diffMs = now - created;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  });

  function onSelect() {
    activeAnnotationId.value = props.annotation.id;
    const mark = document.querySelector(`mark[data-annotation-id="${props.annotation.id}"]`);
    if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function onDelete() {
    if (!annotationActions) return;
    await annotationActions.deleteAnnotation(props.annotation.id);
  }

  function onEdit() {
    if (note.value) {
      editText.value = note.value.content;
      editing.value = true;
    } else {
      editText.value = "";
      editing.value = true;
    }
  }

  async function onSaveEdit() {
    if (!annotationActions) return;
    if (note.value) {
      await annotationActions.updateNote(note.value.id, editText.value);
    } else if (editText.value.trim()) {
      await annotationActions.addNote(props.annotation.id, editText.value.trim());
    }
    editing.value = false;
    editText.value = "";
  }

  function onCancelEdit() {
    editing.value = false;
    editText.value = "";
  }
</script>

<template>
  <div
    class="note"
    :class="{ active: isActive }"
    @click="onSelect"
  >
    <div class="header">
      <span class="color-dot" :style="{ backgroundColor: colorValue }" />
      <span class="timestamp text-caption">{{ timeAgo }}</span>
      <div class="actions">
        <Button kind="tertiary" size="sm" icon="Trash" @click.stop="onDelete" />
        <Button kind="tertiary" size="sm" icon="Edit" @click.stop="onEdit" />
        <Button
          kind="tertiary"
          size="sm"
          :icon="collapsed ? 'ChevronDown' : 'ChevronUp'"
          class="no-hide"
          @click.stop="collapsed = !collapsed"
        />
      </div>
    </div>

    <div v-if="!collapsed" class="content">
      <p class="selected-text text-caption">"{{ annotation.selected_text }}"</p>

      <div v-if="editing" class="edit-area">
        <textarea
          v-model="editText"
          class="edit-input"
          rows="2"
          placeholder="Add a note..."
          @click.stop
          @keydown.enter.ctrl.prevent="onSaveEdit"
          @keydown.esc="onCancelEdit"
        />
        <div class="edit-actions">
          <Button kind="tertiary" size="sm" @click.stop="onCancelEdit">Cancel</Button>
          <Button kind="primary" size="sm" @click.stop="onSaveEdit">Save</Button>
        </div>
      </div>

      <p v-else-if="note" class="note-text">{{ note.content }}</p>
    </div>
  </div>
</template>

<style scoped>
  .note {
    border: var(--border-extrathin) solid var(--border-primary);
    outline-style: solid;
    outline-color: transparent;
    outline-width: var(--border-extrathin);
    border-radius: 16px;
    padding-block: 8px;
    padding-inline: 12px;
    min-width: 264px;
    position: relative;
    z-index: 2;
    cursor: pointer;
    transition: outline-color 0.3s ease;
  }

  .note.active {
    outline-color: var(--border-action);
  }

  .note:hover {
    outline-color: var(--border-primary);
    box-shadow: var(--shadow-strong);

    & .actions > :not(.no-hide) {
      opacity: 1;
    }
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .timestamp {
    flex: 1;
    font-size: 12px;
    color: var(--dark);
  }

  .actions {
    display: flex;
    gap: 0;

    & > :not(.no-hide) {
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    & :deep(button) {
      width: 24px;
      height: 24px;
    }

    & :deep(.tabler-icon) {
      color: var(--dark);
      margin: 0 !important;
      stroke-width: 1.75;
    }
  }

  .content {
    padding-block: 4px;
  }

  .selected-text {
    color: var(--dark);
    font-style: italic;
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .note-text {
    margin: 4px 0 0;
    color: var(--extra-dark);
    font-size: 14px;
    line-height: 1.4;
  }

  .edit-area {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
  }

  .edit-input {
    width: 100%;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 12px;
    padding: 8px 12px;
    font-family: inherit;
    font-size: 14px;
    resize: none;
    outline: none;
    background-color: var(--surface-hover);
    color: var(--extra-dark);
    transition: var(--transition-bd-color);
  }

  .edit-input:focus {
    border-color: var(--border-action);
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }
</style>
