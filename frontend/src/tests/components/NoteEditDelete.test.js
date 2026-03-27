/**
 * Tests for per-message edit/delete UI in Note.vue (Proposal C: Inline Actions on Active State).
 *
 * - Private notes: edit + delete buttons when card is active and message is own
 * - Shared threads: edit button only (no delete) when card is active and message is own
 * - "edited" indicator shown when updated_at differs from created_at
 * - Inline edit mode with textarea, save/cancel
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const noteSource = readFileSync(
  resolve(__dirname, "../../components/annotations/Note.vue"),
  "utf-8",
);
const noteScript =
  noteSource.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? "";
const noteTemplate =
  noteSource.match(/<template>([\s\S]*)<\/template>/)?.[1] ?? "";
const noteStyle =
  noteSource.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? "";

describe("Note.vue — per-message edit/delete", () => {
  describe("state management", () => {
    it("has editingMessageId ref for tracking which message is being edited", () => {
      expect(noteScript).toMatch(/editingMessageId.*ref\(null\)/);
    });

    it("has editMessageText ref for the edit textarea content", () => {
      expect(noteScript).toMatch(/editMessageText.*ref\(""\)/);
    });

    it("has confirmingDeleteMessageId ref for delete confirmation", () => {
      expect(noteScript).toMatch(/confirmingDeleteMessageId.*ref\(null\)/);
    });
  });

  describe("helper functions", () => {
    it("has isOwnMessage function checking user ownership", () => {
      expect(noteScript).toMatch(/function isOwnMessage\(msg\)/);
      expect(noteScript).toMatch(/msg\.owner_id === user\.value\.id/);
    });

    it("has isMessageEdited function comparing updated_at to created_at", () => {
      expect(noteScript).toMatch(/function isMessageEdited\(msg\)/);
      expect(noteScript).toMatch(/msg\.updated_at/);
    });

    it("has editedTimeAgo function for edited tooltip", () => {
      expect(noteScript).toMatch(/function editedTimeAgo\(msg\)/);
    });
  });

  describe("shared thread template", () => {
    it("shows edited tag in thread message header", () => {
      expect(noteTemplate).toMatch(/isMessageEdited\(msg\)/);
      expect(noteTemplate).toMatch(/class="edited-tag"/);
      expect(noteTemplate).toMatch(/editedTimeAgo\(msg\)/);
    });

    it("shows edit button for own messages when card is active", () => {
      expect(noteTemplate).toMatch(/isActive && isOwnMessage\(msg\)/);
    });

    it("does NOT show delete button in shared thread messages", () => {
      // Extract the shared thread section: from class="thread" to the reply-area
      const sharedThreadSection = noteTemplate.match(
        /class="thread"[\s\S]*?class="reply-area"/,
      )?.[0];
      expect(sharedThreadSection).toBeDefined();
      // Should have inline edit button for messages
      expect(sharedThreadSection).toMatch(/onEditMessage\(msg\)/);
      // Should NOT have delete button for individual messages in shared threads
      expect(sharedThreadSection).not.toMatch(/onDeleteMessageClick/);
    });

    it("shows inline edit textarea when editingMessageId matches", () => {
      expect(noteTemplate).toMatch(/editingMessageId === msg\.id/);
      expect(noteTemplate).toMatch(/onSaveMessageEdit\(msg\)/);
      expect(noteTemplate).toMatch(/onCancelMessageEdit/);
    });
  });

  describe("private note template", () => {
    it("shows edited indicator for private notes in the header", () => {
      // The edited tag for private notes is in the header, next to the timestamp
      const headerSection = noteTemplate.match(
        /class="header"[\s\S]*?class="actions"/,
      )?.[0];
      expect(headerSection).toBeDefined();
      expect(headerSection).toMatch(/isMessageEdited\(note\)/);
      expect(headerSection).toMatch(/editedTimeAgo\(note\)/);
    });

    it("shows both edit and delete buttons for own private notes", () => {
      expect(noteTemplate).toMatch(/onEditMessage\(note\)/);
      expect(noteTemplate).toMatch(/onDeleteMessageClick\(note\)/);
    });

    it("shows inline edit textarea when editingMessageId matches note", () => {
      expect(noteTemplate).toMatch(/editingMessageId === note\.id/);
    });
  });

  describe("edit flow", () => {
    it("onEditMessage sets editingMessageId and editMessageText", () => {
      expect(noteScript).toMatch(/function onEditMessage\(msg\)/);
      expect(noteScript).toMatch(/editingMessageId\.value = msg\.id/);
      expect(noteScript).toMatch(/editMessageText\.value = msg\.content/);
    });

    it("onSaveMessageEdit calls annotationActions.updateNote", () => {
      expect(noteScript).toMatch(/function onSaveMessageEdit\(msg\)/);
      expect(noteScript).toMatch(/annotationActions\.updateNote\(msg\.id/);
    });

    it("onCancelMessageEdit resets state", () => {
      expect(noteScript).toMatch(/function onCancelMessageEdit/);
      expect(noteScript).toMatch(/editingMessageId\.value = null/);
    });

    it("header Edit button delegates to onEditMessage for existing notes", () => {
      // onEdit should call onEditMessage(note.value) when note exists
      expect(noteScript).toMatch(/onEditMessage\(note\.value\)/);
    });
  });

  describe("delete flow (private only)", () => {
    it("onDeleteMessageClick uses two-click armed pattern with debounce", () => {
      expect(noteScript).toMatch(/function onDeleteMessageClick\(msg\)/);
      expect(noteScript).toMatch(/confirmingDeleteMessageId\.value === msg\.id/);
      expect(noteScript).toMatch(/deleteMessageArmedAt/);
    });

    it("onDeleteMessage calls annotationActions.deleteNote", () => {
      expect(noteScript).toMatch(/function onDeleteMessage\(msg\)/);
      expect(noteScript).toMatch(/annotationActions\.deleteNote\(msg\.id\)/);
    });

    it("delete confirmation has 3-second timeout", () => {
      expect(noteScript).toMatch(/deleteMessageTimeout = setTimeout/);
      expect(noteScript).toMatch(/3000/);
    });
  });

  describe("styles", () => {
    it("has edited-tag styling", () => {
      expect(noteStyle).toMatch(/\.edited-tag/);
      expect(noteStyle).toMatch(/font-style:\s*italic/);
    });

    it("has middle-dot separator before edited tag in headers", () => {
      expect(noteStyle).toMatch(/\.timestamp \+ \.edited-tag::before/);
      expect(noteStyle).toMatch(/\\00B7/);
    });

    it("has message-actions styling", () => {
      expect(noteStyle).toMatch(/\.message-actions/);
    });

    it("has thread-message-edit-area styling", () => {
      expect(noteStyle).toMatch(/\.thread-message-edit-area/);
    });
  });
});
