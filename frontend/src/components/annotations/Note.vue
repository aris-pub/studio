<script setup>
  import { ref, inject, computed, watch, nextTick, onUnmounted, useTemplateRef } from "vue";
  import { HIGHLIGHT_COLORS } from "@/constants/annotationColors.js";
  import Avatar from "@/components/base/Avatar.vue";

  const props = defineProps({
    annotation: { type: Object, required: true },
    searchMatch: { type: Boolean, default: false },
    searchMatchCurrent: { type: Boolean, default: false },
    searchQuery: { type: String, default: "" },
  });

  const COLLAPSE_KEY = "annotation-collapsed";
  function loadCollapsed(id) {
    try {
      const stored = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}");
      return !!stored[id];
    } catch {
      return false;
    }
  }
  function saveCollapsed(id, val) {
    try {
      const stored = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}");
      if (val) stored[id] = true;
      else delete stored[id];
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(stored));
    } catch {
      /* ignore */
    }
  }

  const collapsed = ref(loadCollapsed(props.annotation.id));
  function toggleCollapse() {
    collapsed.value = !collapsed.value;
    saveCollapsed(props.annotation.id, collapsed.value);
  }
  const editing = ref(false);
  const editText = ref("");
  const editInput = ref(null);
  const confirmingDelete = ref(false);
  const confirmingShare = ref(false);
  let deleteTimeout = null;
  let shareTimeout = null;
  const annotationActions = inject("annotationActions", null);
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const user = inject("user", ref(null));

  const isShared = computed(() => props.annotation.visibility === "shared");
  const isOwnAnnotation = computed(() => {
    const userId = user.value?.id;
    return userId && props.annotation.owner_id === userId;
  });
  const annotationOwner = computed(() => props.annotation.owner);

  const isActive = computed(() => activeAnnotationId.value === props.annotation.id);

  const note = computed(() => {
    const msgs = props.annotation.messages?.filter((m) => !m.deleted_at);
    return msgs?.length ? msgs[0] : null;
  });

  const threadMessages = computed(() => {
    return props.annotation.messages?.filter((m) => !m.deleted_at) || [];
  });

  const replyText = ref("");
  const replyInput = ref(null);

  async function onPostReply() {
    if (!annotationActions || !replyText.value.trim()) return;
    try {
      await annotationActions.addNote(props.annotation.id, replyText.value.trim());
      replyText.value = "";
    } catch (err) {
      console.error("Failed to post reply:", err);
    }
  }

  const barColor = computed(() => {
    const colors = HIGHLIGHT_COLORS[props.annotation.color] || HIGHLIGHT_COLORS.purple;
    return colors.border;
  });

  const displayText = computed(() => {
    return props.annotation.selected_text?.trim() || "";
  });

  const previewText = computed(() => {
    return note.value?.content || displayText.value;
  });

  function highlightMatch(text) {
    if (!text || !props.searchMatch || !props.searchQuery) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const queryEscaped = props.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${queryEscaped})`, "gi");
    const cls = props.searchMatchCurrent
      ? "aris-search-highlight--current"
      : "aris-search-highlight";
    return escaped.replace(re, `<span class="${cls}">$1</span>`);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

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

  function onEsc(e) {
    if (editing.value) {
      onCancelEdit();
    } else if (isActive.value) {
      activeAnnotationId.value = null;
      e.currentTarget.blur();
    }
  }

  function onSelect() {
    activeAnnotationId.value = props.annotation.id;
    const mark =
      document.querySelector(`mark[data-annotation-id="${props.annotation.id}"]`) ||
      document.querySelector(`[data-highlight-annotation="${props.annotation.id}"]`);
    if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  let deleteArmedAt = 0;
  const DEBOUNCE_MS = 400;

  function onDeleteClick() {
    if (confirmingDelete.value) {
      if (Date.now() - deleteArmedAt < DEBOUNCE_MS) return;
      onDelete();
      confirmingDelete.value = false;
      clearTimeout(deleteTimeout);
    } else {
      confirmingDelete.value = true;
      deleteArmedAt = Date.now();
      clearTimeout(deleteTimeout);
      deleteTimeout = setTimeout(() => {
        confirmingDelete.value = false;
      }, 3000);
    }
  }

  async function onDelete() {
    if (!annotationActions) return;
    try {
      await annotationActions.deleteAnnotation(props.annotation.id);
    } catch (err) {
      console.error("Failed to delete annotation:", err);
    }
  }

  function onEdit() {
    editText.value = note.value ? note.value.content : "";
    editing.value = true;
    nextTick(() => editInput.value?.focus());
  }

  async function onSaveEdit() {
    if (!annotationActions) return;
    try {
      if (note.value) {
        await annotationActions.updateNote(note.value.id, editText.value);
      } else if (editText.value.trim()) {
        await annotationActions.addNote(props.annotation.id, editText.value.trim());
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    }
    editing.value = false;
    editText.value = "";
  }

  function onCancelEdit() {
    editing.value = false;
    editText.value = "";
  }

  const noteRef = useTemplateRef("note-ref");
  watch(isActive, (active) => {
    if (active) {
      nextTick(() => {
        noteRef.value?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
        if (isShared.value) nextTick(() => replyInput.value?.focus());
      });
    }
  });

  let shareArmedAt = 0;

  function onShareClick() {
    if (confirmingShare.value) {
      if (Date.now() - shareArmedAt < DEBOUNCE_MS) return;
      onShare();
      confirmingShare.value = false;
      clearTimeout(shareTimeout);
    } else {
      confirmingShare.value = true;
      shareArmedAt = Date.now();
      clearTimeout(shareTimeout);
      shareTimeout = setTimeout(() => {
        confirmingShare.value = false;
      }, 3000);
    }
  }

  async function onShare() {
    if (!annotationActions) return;
    try {
      await annotationActions.updateAnnotation(props.annotation.id, { visibility: "shared" });
    } catch (err) {
      console.error("Failed to share annotation:", err);
    }
  }

  onUnmounted(() => {
    clearTimeout(deleteTimeout);
    clearTimeout(shareTimeout);
  });
</script>

<template>
  <div
    ref="note-ref"
    class="note"
    :class="{
      active: isActive && !editing,
      editing,
      collapsed: collapsed && note,
      shared: isShared,
      'search-match': searchMatch,
      'search-match-current': searchMatchCurrent,
    }"
    :style="{ '--note-color': barColor }"
    tabindex="0"
    @click="onSelect"
    @keydown.esc="onEsc"
  >
    <div class="header">
      <Avatar
        v-if="isShared && annotationOwner"
        :user="annotationOwner"
        size="sm"
        :tooltip="true"
      />
      <span v-if="isShared" class="shared-label">Shared</span>
      <span class="timestamp">{{ timeAgo }}</span>
      <div class="actions">
        <Button
          v-if="isOwnAnnotation && !isShared"
          :kind="confirmingShare ? 'primary' : 'tertiary'"
          size="xs"
          :icon="confirmingShare ? '' : 'MessageShare'"
          :text="confirmingShare ? 'Share' : ''"
          :aria-label="confirmingShare ? 'Confirm share' : 'Share annotation'"
          @click.stop="onShareClick"
        />
        <Button
          v-if="isOwnAnnotation"
          kind="tertiary"
          size="xs"
          icon="Edit"
          aria-label="Edit annotation"
          @click.stop="onEdit"
        />
        <Button
          v-if="isOwnAnnotation"
          :kind="confirmingDelete ? 'danger' : 'danger-ghost'"
          size="xs"
          :icon="confirmingDelete ? '' : 'Trash'"
          :text="confirmingDelete ? 'Delete' : ''"
          class="delete-btn"
          :aria-label="confirmingDelete ? 'Confirm delete' : 'Delete annotation'"
          @click.stop="onDeleteClick"
        />
        <Button
          v-if="note"
          kind="tertiary"
          size="xs"
          :icon="collapsed ? 'ChevronDown' : 'ChevronUp'"
          :aria-label="collapsed ? 'Expand annotation' : 'Collapse annotation'"
          @click.stop="toggleCollapse"
        />
      </div>
    </div>

    <p v-if="collapsed" class="collapsed-line note-text" v-html="highlightMatch(previewText)"></p>

    <div v-if="!collapsed" class="content">
      <p class="selected-text" v-html="highlightMatch(displayText)"></p>

      <div v-if="editing" class="edit-area">
        <label :for="`note-edit-${annotation.id}`" class="sr-only">Annotation note</label>
        <textarea
          :id="`note-edit-${annotation.id}`"
          ref="editInput"
          v-model="editText"
          class="edit-input"
          rows="2"
          placeholder="Add a note..."
          @click.stop
          @keydown.enter.exact.prevent="onSaveEdit"
          @keydown.esc.stop="onCancelEdit"
        />
        <div class="edit-actions">
          <Button kind="tertiary" size="sm" @click.stop="onCancelEdit">Cancel</Button>
          <Button kind="primary" size="sm" @click.stop="onSaveEdit">Save</Button>
        </div>
      </div>

      <template v-else-if="isShared">
        <div v-for="msg in threadMessages" :key="msg.id" class="message message--threaded">
          <Avatar v-if="msg.owner" :user="msg.owner" size="sm" :tooltip="true" />
          <p class="note-text" v-html="highlightMatch(msg.content)"></p>
        </div>

        <div v-if="isActive" class="reply-area">
          <label :for="`note-reply-${annotation.id}`" class="sr-only">Reply</label>
          <textarea
            :id="`note-reply-${annotation.id}`"
            ref="replyInput"
            v-model="replyText"
            class="reply-input"
            rows="1"
            placeholder="Reply..."
            @click.stop
            @keydown.enter.exact.prevent="onPostReply"
            @keydown.esc.stop="replyText = ''"
          />
          <Button
            v-if="replyText.trim()"
            kind="primary"
            size="xs"
            icon="Send"
            aria-label="Post reply"
            class="reply-send"
            @click.stop="onPostReply"
          />
        </div>
      </template>

      <p v-else-if="note" class="note-text" v-html="highlightMatch(note.content)"></p>
    </div>
  </div>
</template>

<style scoped>
  .note {
    border: var(--border-extrathin) solid var(--border-primary);
    border-left: 3px solid var(--note-color);
    border-radius: 4px 12px 12px 4px;
    padding: 8px 10px 10px;
    background-color: var(--surface-page);
    position: relative;
    z-index: 2;
    cursor: pointer;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .note:focus-visible {
    outline: 2px solid var(--border-action);
    outline-offset: 2px;
  }

  .note.active:not(:hover) {
    border-color: var(--border-action);
    border-left-color: var(--note-color);
    box-shadow: 0 0 0 1px var(--border-action);
  }

  .note.search-match {
    background-color: color-mix(in srgb, var(--yellow-200) 20%, var(--surface-page));
    border-color: var(--yellow-300);
    border-left-color: var(--note-color);
  }

  .note.search-match-current {
    background-color: color-mix(in srgb, var(--orange-200) 25%, var(--surface-page));
    border-color: var(--orange-300);
    border-left-color: var(--note-color);
  }

  .note.collapsed .actions > :last-child {
    opacity: 1;
  }

  .note:hover,
  .note:focus-within {
    border-color: var(--border-primary);
    border-left-color: var(--note-color);
    box-shadow: var(--shadow-soft);

    & .actions > * {
      opacity: 1;
    }
  }

  .note.active:hover {
    border-color: var(--border-action);
    border-left-color: var(--note-color);
    box-shadow:
      0 0 0 1px var(--border-action),
      var(--shadow-soft);
  }

  .note.shared {
    border-radius: 12px;
    border-left: var(--border-extrathin) solid var(--border-primary);
    border-top: 3px solid var(--note-color);
    background-color: var(--surface-hover);
  }

  .note.shared.active:not(:hover) {
    border-left-color: var(--border-action);
  }

  .note.shared:hover,
  .note.shared:focus-within {
    border-left-color: var(--border-primary);
  }

  .note.shared.active:hover {
    border-left-color: var(--border-action);
  }

  .note.shared.search-match {
    border-left-color: var(--yellow-300);
  }

  .note.shared.search-match-current {
    border-left-color: var(--orange-300);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .shared-label {
    font-size: 10px;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--note-color);
  }

  .timestamp {
    flex: 1;
    color: var(--gray-800);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .actions {
    display: flex;
    gap: 0;
    margin-right: -4px;

    & > * {
      opacity: 0;
      transition: opacity 0.2s ease;
    }
  }

  .delete-icon {
    width: 16px;
    height: 16px;
    color: var(--gray-700);
    stroke-width: 1.5;
  }

  .delete-label {
    font-size: 11px;
    font-weight: var(--weight-medium);
    color: var(--red-600);
    white-space: nowrap;
  }

  .collapsed-line {
    margin: 4px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .content {
    margin-top: 6px;
  }

  .selected-text {
    color: var(--gray-800);
    font-style: italic;
    font-size: 13px;
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .note-text {
    margin: 6px 0 0;
    color: var(--extra-dark);
    font-size: 14px;
    font-weight: var(--weight-medium);
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .message--threaded {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 6px;
  }

  .message--threaded :deep(.av-wrapper) {
    margin-top: 2px;
    flex-shrink: 0;
  }

  .message--threaded .note-text {
    margin: 0;
    flex: 1;
    min-width: 0;
  }

  .reply-area {
    position: relative;
    margin-top: 8px;
  }

  .reply-input {
    width: 100%;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 8px;
    padding: 6px 10px;
    padding-right: 32px;
    font-family: inherit;
    font-size: 13px;
    resize: none;
    outline: none;
    background-color: var(--surface-page);
    color: var(--extra-dark);
    transition: var(--transition-bd-color);
  }

  .reply-input:focus {
    border-color: var(--border-action);
  }

  .reply-send {
    position: absolute;
    right: 4px;
    bottom: 4px;
  }

  .edit-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }

  .edit-input {
    width: 100%;
    border: var(--border-thin) solid var(--border-primary);
    border-radius: 8px;
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
    outline: 2px solid var(--border-action);
    outline-offset: -2px;
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
