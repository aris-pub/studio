<script setup>
  import { ref, inject, computed, watch, nextTick, onMounted, onUnmounted, useTemplateRef } from "vue";
  import { HIGHLIGHT_COLORS, SWATCH_COLORS } from "@/constants/annotationColors.js";
  import { renderInlineMath, ensureTemml } from "@/utils/renderInlineMath.js";
  import Avatar from "@/components/base/Avatar.vue";
  import TextareaInput from "@/components/base/TextareaInput.vue";
  import { toast } from "@/utils/toast.js";

  // Load Temml from CDN if not already loaded (e.g. by onload.js), then
  // flip a reactive flag so Vue re-renders cards with rendered math.
  const temmlReady = ref(!!window.temml);
  onMounted(async () => {
    if (!temmlReady.value) {
      await ensureTemml();
      temmlReady.value = true;
    }
  });

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
  const isSaving = ref(false);
  const editInput = ref(null);
  const confirmingDelete = ref(false);
  const confirmingShare = ref(false);
  let deleteTimeout = null;
  let shareTimeout = null;
  const annotationActions = inject("annotationActions", null);
  const activeAnnotationId = inject("activeAnnotationId", ref(null));
  const user = inject("user", ref(null));
  const file = inject("file", ref(null));

  const isShared = computed(() => props.annotation.visibility === "shared");
  const isOwnAnnotation = computed(() => {
    const userId = user.value?.id;
    return userId && props.annotation.owner_id === userId;
  });
  const isFileOwner = computed(() => {
    const userId = user.value?.id;
    return userId && file.value?.ownerId === userId;
  });
  const canDelete = computed(() => isOwnAnnotation.value || (isShared.value && isFileOwner.value));
  const annotationOwner = computed(() => props.annotation.owner);

  const isActive = computed(() => activeAnnotationId.value === props.annotation.id);

  const note = computed(() => {
    const msgs = props.annotation.messages?.filter((m) => !m.deleted_at);
    return msgs?.length ? msgs[0] : null;
  });

  const threadMessages = computed(() => {
    const msgs = props.annotation.messages?.filter((m) => !m.deleted_at) || [];
    return msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  });

  const replyText = ref("");
  const replyInput = ref(null);

  // Per-message edit/delete state
  const editingMessageId = ref(null);
  const editMessageText = ref("");
  const editMessageInput = ref(null);
  const confirmingDeleteMessageId = ref(null);
  let deleteMessageTimeout = null;
  let deleteMessageArmedAt = 0;

  function isOwnMessage(msg) {
    return user.value?.id && msg.owner_id === user.value.id;
  }

  function isMessageEdited(msg) {
    return msg.updated_at && msg.updated_at !== msg.created_at;
  }

  function editedTimeAgo(msg) {
    if (!msg.updated_at) return "";
    void timeTick.value;
    const updated = new Date(msg.updated_at);
    const now = new Date();
    const diffMs = now - updated;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Edited just now";
    if (diffMin < 60) return `Edited ${diffMin}min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Edited ${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `Edited ${diffDay}d ago`;
  }

  function onEditMessage(msg) {
    editingMessageId.value = msg.id;
    editMessageText.value = msg.content;
    nextTick(() => {
      const el = editMessageInput.value;
      // In v-for, ref is an array; outside v-for, it's a single element
      const textarea = Array.isArray(el) ? el[0] : el;
      textarea?.focus();
    });
  }

  async function onSaveMessageEdit(msg, submittedValue) {
    if (!annotationActions) return;
    const content = submittedValue || editMessageText.value;
    isSaving.value = true;
    try {
      await annotationActions.updateNote(msg.id, content);
      editingMessageId.value = null;
      editMessageText.value = "";
    } catch (err) {
      console.error("Failed to update message:", err);
      toast.error("Couldn't save edit");
    } finally {
      isSaving.value = false;
    }
  }

  function onCancelMessageEdit() {
    editingMessageId.value = null;
    editMessageText.value = "";
  }

  function onDeleteMessageClick(msg) {
    if (confirmingDeleteMessageId.value === msg.id) {
      if (Date.now() - deleteMessageArmedAt < DEBOUNCE_MS) return;
      onDeleteMessage(msg);
      confirmingDeleteMessageId.value = null;
      clearTimeout(deleteMessageTimeout);
    } else {
      confirmingDeleteMessageId.value = msg.id;
      deleteMessageArmedAt = Date.now();
      clearTimeout(deleteMessageTimeout);
      deleteMessageTimeout = setTimeout(() => {
        confirmingDeleteMessageId.value = null;
      }, 3000);
    }
  }

  async function onDeleteMessage(msg) {
    if (!annotationActions) return;
    try {
      await annotationActions.deleteNote(msg.id);
    } catch (err) {
      console.error("Failed to delete message:", err);
      toast.error("Couldn't delete note");
    }
  }

  async function onPostReply(submittedValue) {
    const content = submittedValue || replyText.value;
    if (!annotationActions || !content.trim()) return;
    isSaving.value = true;
    try {
      await annotationActions.addNote(props.annotation.id, content.trim());
      replyText.value = "";
    } catch (err) {
      console.error("Failed to post reply:", err);
      toast.error("Couldn't post reply");
    } finally {
      isSaving.value = false;
    }
  }

  const showColorPicker = ref(false);

  const emit = defineEmits(["resize"]);

  function toggleColorPicker() {
    showColorPicker.value = !showColorPicker.value;
    if (showColorPicker.value && collapsed.value) {
      collapsed.value = false;
    }
    nextTick(() => emit("resize"));
  }

  async function onChangeColor(colorName) {
    if (!annotationActions) return;
    try {
      await annotationActions.updateAnnotation(props.annotation.id, { color: colorName });
      showColorPicker.value = false;
    } catch (err) {
      console.error("Failed to change color:", err);
      toast.error("Couldn't change color");
    }
  }

  const colorName = computed(() => props.annotation.color || "purple");
  const barColor = computed(() => {
    const colors = HIGHLIGHT_COLORS[colorName.value] || HIGHLIGHT_COLORS.purple;
    return colors.border;
  });

  const displayText = computed(() => {
    return props.annotation.selected_text?.trim() || "";
  });

  const previewText = computed(() => {
    return note.value?.content || displayText.value;
  });

  function highlightMatch(text) {
    // Access reactive dep so Vue re-renders when temml becomes available
    void temmlReady.value;
    if (!text) return "";
    if (!props.searchMatch || !props.searchQuery) return renderInlineMath(text);
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

  const timeTick = ref(0);
  const tickInterval = setInterval(() => timeTick.value++, 60000);
  onUnmounted(() => clearInterval(tickInterval));

  const timeAgo = computed(() => {
    void timeTick.value;
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

  function messageTimeAgo(msg) {
    if (!msg.created_at) return "";
    const created = new Date(msg.created_at);
    const now = new Date();
    const diffMs = now - created;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d`;
  }

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
      toast.error("Couldn't delete annotation");
    }
  }

  function onEdit() {
    if (note.value) {
      onEditMessage(note.value);
    } else {
      editText.value = "";
      editing.value = true;
      nextTick(() => editInput.value?.focus());
    }
  }

  async function onSaveEdit(submittedValue) {
    if (!annotationActions) return;
    const content = submittedValue || editText.value;
    isSaving.value = true;
    try {
      if (note.value) {
        await annotationActions.updateNote(note.value.id, content);
      } else if (content.trim()) {
        await annotationActions.addNote(props.annotation.id, content.trim());
      }
      editing.value = false;
      editText.value = "";
    } catch (err) {
      console.error("Failed to save note:", err);
      toast.error("Couldn't save note");
    } finally {
      isSaving.value = false;
    }
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
        const hasMessages = threadMessages.value.length > 0;
        if (!hasMessages) {
          // Newly created annotation with no messages — open in edit mode
          onEdit();
        } else if (isShared.value) {
          nextTick(() => replyInput.value?.focus());
        }
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
      toast.error("Couldn't share annotation");
    }
  }

  onUnmounted(() => {
    clearTimeout(deleteTimeout);
    clearTimeout(shareTimeout);
    clearTimeout(deleteMessageTimeout);
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
    :style="{
      '--note-color': barColor,
      '--note-color-50': `var(--${colorName}-50)`,
      '--note-color-100': `var(--${colorName}-100)`,
      '--note-color-200': `var(--${colorName}-200)`,
    }"
    tabindex="0"
    @click="onSelect"
    @keydown.esc="onEsc"
  >
    <div class="header">
      <span v-if="isShared" class="shared-label">Shared</span>
      <span class="timestamp">{{ timeAgo }}</span>
      <span
        v-if="!isShared && note && isMessageEdited(note)"
        class="edited-tag"
        :title="editedTimeAgo(note)"
      >edited</span>
      <div class="actions">
        <Button
          v-if="isOwnAnnotation && !isShared"
          :kind="confirmingShare ? 'primary' : 'tertiary'"
          size="xs"
          :icon="confirmingShare ? '' : 'MessageShare'"
          :text="confirmingShare ? 'Share' : ''"
          :title="confirmingShare ? 'Confirm share' : 'Share'"
          :aria-label="confirmingShare ? 'Confirm share' : 'Share annotation'"
          @click.stop="onShareClick"
        />
        <Button
          v-if="isOwnAnnotation"
          kind="tertiary"
          size="xs"
          icon="Highlight"
          title="Color"
          aria-label="Change color"
          @click.stop="toggleColorPicker"
        />
        <Button
          v-if="isOwnAnnotation"
          kind="tertiary"
          size="xs"
          icon="Edit"
          title="Edit"
          aria-label="Edit annotation"
          @click.stop="onEdit"
        />
        <Button
          v-if="canDelete && isShared"
          kind="tertiary"
          size="xs"
          icon="CircleCheck"
          class="resolve-btn"
          title="Resolve"
          aria-label="Resolve annotation"
          @click.stop="onDelete"
        />
        <Button
          v-if="canDelete && !isShared"
          :kind="confirmingDelete ? 'danger' : 'danger-ghost'"
          size="xs"
          :icon="confirmingDelete ? '' : 'Trash'"
          :text="confirmingDelete ? 'Delete' : ''"
          :title="confirmingDelete ? 'Confirm delete' : 'Delete'"
          class="delete-btn"
          :aria-label="confirmingDelete ? 'Confirm delete' : 'Delete annotation'"
          @click.stop="onDeleteClick"
        />
        <Button
          v-if="note"
          kind="tertiary"
          size="xs"
          :icon="collapsed ? 'ChevronDown' : 'ChevronUp'"
          :title="collapsed ? 'Expand' : 'Collapse'"
          :aria-label="collapsed ? 'Expand annotation' : 'Collapse annotation'"
          @click.stop="toggleCollapse"
        />
      </div>
    </div>

    <div v-if="showColorPicker" class="color-picker" @click.stop>
      <button
        v-for="(color, name) in SWATCH_COLORS"
        :key="name"
        type="button"
        class="swatch-btn"
        :class="{ active: annotation.color === name }"
        :aria-label="`Change to ${name}`"
        @click="onChangeColor(name)"
      >
        <span class="swatch-circle" :style="{ backgroundColor: color }" />
      </button>
    </div>

    <p v-if="collapsed" class="collapsed-line note-text" v-html="highlightMatch(previewText)"></p>

    <div v-if="!collapsed" class="content">
      <p class="selected-text" v-html="highlightMatch(displayText)"></p>

      <div v-if="editing" class="edit-area" @click.stop>
        <TextareaInput
          ref="editInput"
          :model-value="editText"
          placeholder="Add a note..."
          :rows="2"
          :compact="true"
          layout="inline"
          :show-buttons="false"
          :submit-on-enter="true"
          @update:model-value="editText = $event"
          @submit="onSaveEdit"
          @keydown.esc.stop="onCancelEdit"
        />
        <div class="edit-actions">
          <Button kind="tertiary" size="sm" @click.stop="onCancelEdit">Cancel</Button>
          <Button kind="primary" size="sm" @click.stop="onSaveEdit">Save</Button>
        </div>
      </div>

      <template v-else-if="isShared">
        <div class="thread">
          <div
            v-for="(msg, idx) in threadMessages"
            :key="msg.id"
            class="thread-message"
            :class="{ 'thread-message--first': idx === 0 }"
          >
            <div class="thread-message-header">
              <Avatar v-if="msg.owner" :user="msg.owner" size="sm" :tooltip="true" />
              <span class="thread-author">{{ msg.owner?.name || "Unknown" }}</span>
              <span class="thread-time">{{ messageTimeAgo(msg) }}</span>
              <span
                v-if="isMessageEdited(msg)"
                class="edited-tag"
                :title="editedTimeAgo(msg)"
              >edited</span>
            </div>
            <template v-if="editingMessageId === msg.id">
              <div class="thread-message-edit-area" @click.stop>
                <TextareaInput
                  ref="editMessageInput"
                  :model-value="editMessageText"
                  :rows="2"
                  :compact="true"
                  layout="inline"
                  :show-buttons="false"
                  :submit-on-enter="true"
                  @update:model-value="editMessageText = $event"
                  @submit="(val) => onSaveMessageEdit(msg, val)"
                  @keydown.esc.stop="onCancelMessageEdit"
                />
                <div class="edit-actions">
                  <Button kind="tertiary" size="xs" @click.stop="onCancelMessageEdit">Cancel</Button>
                  <Button kind="primary" size="xs" @click.stop="onSaveMessageEdit(msg)">Save</Button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="thread-body-row">
                <p class="thread-body" v-html="highlightMatch(msg.content)"></p>
                <button
                  v-if="isActive && isOwnMessage(msg)"
                  class="inline-edit-btn"
                  aria-label="Edit message"
                  @click.stop="onEditMessage(msg)"
                >
                  <Icon name="Edit" :size="13" />
                </button>
              </div>
            </template>
          </div>

          <div v-if="isActive" class="reply-area" @click.stop>
            <TextareaInput
              ref="replyInput"
              :model-value="replyText"
              placeholder="Reply..."
              :rows="1"
              :compact="true"
              layout="inline"
              :show-buttons="replyText.trim().length > 0"
              :submit-on-enter="true"
              submit-button-icon="Send"
              submit-button-kind="primary"
              submit-button-size="xs"
              @update:model-value="replyText = $event"
              @submit="onPostReply"
              @keydown.esc.stop="replyText = ''"
            />
          </div>
        </div>
      </template>

      <template v-else-if="note">
        <template v-if="editingMessageId === note.id">
          <div class="thread-message-edit-area" @click.stop>
            <TextareaInput
              ref="editMessageInput"
              :model-value="editMessageText"
              :rows="2"
              :compact="true"
              layout="inline"
              :show-buttons="false"
              :submit-on-enter="true"
              @update:model-value="editMessageText = $event"
              @submit="(val) => onSaveMessageEdit(note, val)"
              @keydown.esc.stop="onCancelMessageEdit"
            />
            <div class="edit-actions">
              <Button kind="tertiary" size="xs" @click.stop="onCancelMessageEdit">Cancel</Button>
              <Button kind="primary" size="xs" @click.stop="onSaveMessageEdit(note)">Save</Button>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="note-text" v-html="highlightMatch(note.content)"></p>
          <div v-if="isActive && isOwnMessage(note)" class="message-actions">
            <Button
              kind="tertiary"
              size="xs"
              icon="Edit"
              text="Edit"
              aria-label="Edit note"
              @click.stop="onEditMessage(note)"
            />
            <Button
              :kind="confirmingDeleteMessageId === note.id ? 'danger' : 'danger-ghost'"
              size="xs"
              :icon="confirmingDeleteMessageId === note.id ? '' : 'Trash'"
              :text="confirmingDeleteMessageId === note.id ? 'Delete' : 'Delete'"
              :aria-label="confirmingDeleteMessageId === note.id ? 'Confirm delete note' : 'Delete note'"
              @click.stop="onDeleteMessageClick(note)"
            />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
  /* ---------------------------------------------------------------
     PRIVATE MARGINALIA — borderless, transparent, quiet
     --------------------------------------------------------------- */
  .note {
    border: none;
    border-left: 2px solid var(--note-color);
    border-radius: 0 8px 8px 0;
    padding: 4px 8px 6px;
    background-color: transparent;
    position: relative;
    z-index: 2;
    cursor: pointer;
    outline: none;
    transition:
      background-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .note:focus-visible {
    outline: 2px solid var(--border-action);
    outline-offset: 2px;
  }

  .note:not(.shared).active:not(:hover) {
    background-color: color-mix(in srgb, var(--note-color) 6%, transparent);
  }

  .note.shared.active:not(:hover) {
    background-color: var(--surface-page);
  }

  .note.search-match {
    background-color: color-mix(in srgb, var(--yellow-200) 20%, transparent);
  }

  .note.search-match-current {
    background-color: color-mix(in srgb, var(--orange-200) 25%, transparent);
  }

  .note.collapsed .actions > :last-child {
    opacity: 1;
  }

  .note:not(.shared):hover,
  .note:not(.shared):focus-within {
    background-color: color-mix(in srgb, var(--note-color) 4%, transparent);
    box-shadow: none;
  }

  .note:hover .actions > *,
  .note:focus-within .actions > * {
    opacity: 1;
  }

  .note:not(.shared).active:hover {
    background-color: color-mix(in srgb, var(--note-color) 8%, transparent);
    box-shadow: none;
  }

  /* ---------------------------------------------------------------
     SHARED COMMENT THREAD — clean card, subtle shadow, no heavy borders
     --------------------------------------------------------------- */
  .note.shared {
    border: none;
    border-left: none;
    border-radius: var(--radius-lg);
    padding: 12px 14px 14px;
    background-color: var(--surface-page);
    box-shadow: 0 1px 4px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06);
  }

  .note.shared.active:not(:focus-within) {
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 2px 10px var(--note-color-100);
  }

  .note.shared:hover:not(.active) {
    background-color: var(--surface-page);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 2px 10px var(--note-color-100);
  }

  .note.shared.search-match {
    background-color: color-mix(in srgb, var(--yellow-200) 20%, var(--surface-page));
    box-shadow: var(--shadow-soft);
  }

  .note.shared.search-match-current {
    background-color: color-mix(in srgb, var(--orange-200) 25%, var(--surface-page));
    box-shadow: var(--shadow-soft);
  }

  /* ---------------------------------------------------------------
     HEADER
     --------------------------------------------------------------- */
  .header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .shared-label {
    font-size: 10px;
    font-weight: var(--weight-semi);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray-800);
  }

  .timestamp {
    flex: 1;
    color: var(--gray-800);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .note:not(.shared) .timestamp {
    color: var(--gray-800);
    font-size: 10px;
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

  .resolve-btn :deep(.tabler-icon) {
    transition: color 0.15s ease;
  }

  .delete-label {
    font-size: 11px;
    font-weight: var(--weight-medium);
    color: var(--red-600);
    white-space: nowrap;
  }

  /* ---------------------------------------------------------------
     COLLAPSED / CONTENT
     --------------------------------------------------------------- */
  .collapsed-line {
    margin: 4px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .content {
    margin-top: 6px;
  }

  /* ---------------------------------------------------------------
     SELECTED TEXT — different treatment per type
     --------------------------------------------------------------- */
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

  .note:not(.shared) .selected-text {
    color: var(--gray-700);
    font-size: 12px;
    line-height: 1.35;
  }

  .note.shared .selected-text {
    padding: 4px 8px;
    background-color: var(--note-color-50);
    border: var(--border-extrathin) solid var(--note-color-100);
    border-radius: 6px;
    border-left: none;
    font-size: 12px;
    font-style: italic;
    color: var(--gray-700);
    -webkit-line-clamp: 3;
  }

  /* ---------------------------------------------------------------
     NOTE TEXT (private annotations only)
     --------------------------------------------------------------- */
  .note-text {
    margin: 6px 0 0;
    color: var(--extra-dark);
    font-size: 14px;
    font-weight: var(--weight-medium);
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .note:not(.shared) .note-text {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.45;
  }

  /* ---------------------------------------------------------------
     THREAD (shared comment threads)
     --------------------------------------------------------------- */
  .thread {
    margin-top: 10px;
    padding-top: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .thread-message {
    padding: 6px 0;
    border-radius: 0;
    background-color: transparent;
  }

  .thread-message + .thread-message {
    border-top: var(--border-extrathin) solid var(--border-primary);
  }

  .thread-message--first {
    background-color: transparent;
  }

  .thread-message-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .thread-message-header :deep(.av-wrapper) {
    flex-shrink: 0;
  }

  .thread-author {
    font-size: 12px;
    font-weight: var(--weight-bold);
    color: var(--extra-dark);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .thread-time {
    font-size: 10px;
    color: var(--gray-800);
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .thread-body {
    margin: 3px 0 0 22px;
    color: var(--extra-dark);
    font-size: 13px;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .edited-tag {
    font-size: 10px;
    color: var(--gray-600);
    font-style: italic;
    flex-shrink: 0;
  }

  .thread-time + .edited-tag::before,
  .timestamp + .edited-tag::before {
    content: "\00B7\00A0";
    font-style: normal;
  }

  .message-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    margin: 4px 0 0;
  }

  .thread-body-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    margin: 3px 0 0 22px;
  }

  .thread-body-row .thread-body {
    margin: 0;
    flex: 1;
    min-width: 0;
  }

  .inline-edit-btn {
    flex-shrink: 0;
    padding: 2px;
    border: none;
    background: none;
    color: var(--gray-600);
    cursor: pointer;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease;
  }

  .thread-message:hover .inline-edit-btn,
  .inline-edit-btn:focus-visible {
    opacity: 1;
  }

  .inline-edit-btn:hover {
    color: var(--extra-dark);
    background-color: var(--surface-hover);
  }

  .inline-edit-btn:focus-visible {
    outline: 2px solid var(--border-action);
    outline-offset: 1px;
  }


  .thread-message-edit-area {
    margin: 3px 0 0 22px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .note:not(.shared) .thread-message-edit-area {
    margin-left: 0;
    margin-top: 6px;
  }


  /* ---------------------------------------------------------------
     REPLY AREA (shared threads)
     --------------------------------------------------------------- */
  .reply-area {
    position: relative;
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--border-primary);
  }

  .reply-area :deep(.textarea-input) {
    padding: 0;
    background: transparent;
    border-top: none;
    backdrop-filter: none;
  }

  /* ---------------------------------------------------------------
     EDIT AREA (both types)
     --------------------------------------------------------------- */
  .edit-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }

  .edit-area :deep(.textarea-input),
  .thread-message-edit-area :deep(.textarea-input) {
    padding: 0;
    background: transparent;
    border-top: none;
    backdrop-filter: none;
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }


  .color-picker {
    display: flex;
    gap: 2px;
    padding: 2px 6px 4px;
  }

  .color-picker .swatch-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .color-picker .swatch-btn:hover {
    background-color: var(--blue-100);
  }

  .color-picker .swatch-btn.active {
    outline: 2px solid var(--border-action);
    outline-offset: 1px;
  }

  .color-picker .swatch-btn:focus-visible {
    outline: 2px solid var(--border-action);
    outline-offset: 2px;
  }

  .color-picker .swatch-circle {
    display: block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: var(--border-extrathin) solid var(--gray-800);
    pointer-events: none;
  }
</style>
