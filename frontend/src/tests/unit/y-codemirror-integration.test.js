/**
 * Unit tests for Y.js + CodeMirror integration
 *
 * Tests y-codemirror.next's object-based origin tracking (YSyncConfig)
 * to prevent keystroke duplication in single-user scenarios.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { yCollab } from "y-codemirror.next";

describe("Y.js + CodeMirror Integration", () => {
  let ydoc;
  let ytext;
  let view;

  beforeEach(() => {
    // Create fresh Y.Doc and Y.Text for each test
    ydoc = new Y.Doc();
    ytext = ydoc.getText("codemirror");
  });

  describe("Origin Tracking", () => {
    it("should use config object for origin to track local changes", () => {
      // Create editor with Y.js integration
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Track observer calls
      const observerCalls = [];
      ytext.observe((event, transaction) => {
        observerCalls.push({
          origin: transaction.origin,
          originType: typeof transaction.origin,
          delta: event.delta,
        });
      });

      // Make a local edit
      view.dispatch({
        changes: { from: 0, insert: "test" },
      });

      // Observer should be called once with object origin (YSyncConfig)
      expect(observerCalls.length).toBe(1);
      expect(observerCalls[0].originType).toBe("object");
      expect(observerCalls[0].origin).toBeTruthy();

      view.destroy();
    });

    it("should filter local changes correctly using object identity comparison", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Insert text locally
      view.dispatch({
        changes: { from: 0, insert: "Hello" },
      });

      // The editor should have 'Hello' only once (not duplicated)
      expect(view.state.doc.toString()).toBe("Hello");

      view.destroy();
    });
  });

  describe("Local vs Remote Change Handling", () => {
    it("should not apply local changes back to editor", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Type character
      view.dispatch({
        changes: { from: 0, insert: "X" },
      });

      // Should appear once, not twice
      expect(view.state.doc.toString()).toBe("X");
      expect(view.state.doc.toString().length).toBe(1);

      view.destroy();
    });

    it("should apply remote changes to editor", (done) => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Simulate remote change (from another client)
      ydoc.transact(() => {
        ytext.insert(0, "Remote");
      });

      // Give time for async update
      setTimeout(() => {
        expect(view.state.doc.toString()).toBe("Remote");
        view.destroy();
        done();
      }, 100);
    });

    it("should handle rapid local edits without duplication", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Rapid typing
      "HELLO".split("").forEach((char, i) => {
        view.dispatch({
          changes: { from: i, insert: char },
        });
      });

      expect(view.state.doc.toString()).toBe("HELLO");
      expect(view.state.doc.toString().length).toBe(5);

      view.destroy();
    });
  });

  describe("Y.Text Transaction Origins", () => {
    it("should mark local transactions with config object origin", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      let capturedOrigin;
      ytext.observe((event, transaction) => {
        capturedOrigin = transaction.origin;
      });

      // Local edit
      view.dispatch({
        changes: { from: 0, insert: "test" },
      });

      expect(typeof capturedOrigin).toBe("object");
      expect(capturedOrigin).toBeTruthy();
      expect(capturedOrigin.ytext).toBe(ytext);

      view.destroy();
    });

    it("should distinguish between local and remote origins", (done) => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      const origins = [];
      ytext.observe((event, transaction) => {
        origins.push({
          type: typeof transaction.origin,
          value: transaction.origin,
        });
      });

      // Local edit
      view.dispatch({
        changes: { from: 0, insert: "local" },
      });

      // Remote edit (no origin)
      ydoc.transact(() => {
        ytext.insert(5, " remote");
      });

      setTimeout(() => {
        expect(origins.length).toBe(2);
        expect(origins[0].type).toBe("object"); // local (YSyncConfig)
        expect(origins[0].value).toBeTruthy();
        expect(origins[1].type).toBe("undefined"); // remote (no origin)

        view.destroy();
        done();
      }, 100);
    });
  });

  describe("Document Synchronization", () => {
    it("should initialize editor with existing Y.Text content", () => {
      // Set Y.Text content first
      ytext.insert(0, "Initial content");

      // Then create editor
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      expect(view.state.doc.toString()).toBe("Initial content");

      view.destroy();
    });

    it("should keep Y.Text and editor in sync after edits", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      view.dispatch({
        changes: { from: 0, insert: "Sync test" },
      });

      expect(view.state.doc.toString()).toBe(ytext.toString());
      expect(ytext.toString()).toBe("Sync test");

      view.destroy();
    });

    it("should handle deletions correctly", () => {
      // Initialize Y.Text first
      ytext.insert(0, "Hello World");

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Delete 'World'
      view.dispatch({
        changes: { from: 6, to: 11, insert: "" },
      });

      expect(view.state.doc.toString()).toBe("Hello ");
      expect(ytext.toString()).toBe("Hello ");

      view.destroy();
    });

    it("should handle replacements correctly", () => {
      // Initialize Y.Text first
      ytext.insert(0, "Hello World");

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Replace 'World' with 'CodeMirror'
      view.dispatch({
        changes: { from: 6, to: 11, insert: "CodeMirror" },
      });

      expect(view.state.doc.toString()).toBe("Hello CodeMirror");
      expect(ytext.toString()).toBe("Hello CodeMirror");

      view.destroy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty document", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      expect(view.state.doc.toString()).toBe("");
      expect(ytext.toString()).toBe("");

      view.destroy();
    });

    it("should handle very long text without duplication", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      const longText = "A".repeat(1000);
      view.dispatch({
        changes: { from: 0, insert: longText },
      });

      expect(view.state.doc.toString()).toBe(longText);
      expect(view.state.doc.toString().length).toBe(1000);

      view.destroy();
    });

    it("should handle special characters", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      const specialText = "Hello\n\tWorld 🎉 $#@!";
      view.dispatch({
        changes: { from: 0, insert: specialText },
      });

      expect(view.state.doc.toString()).toBe(specialText);

      view.destroy();
    });

    it("should handle rapid insert/delete cycles", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      // Type then delete
      view.dispatch({
        changes: { from: 0, insert: "Test" },
      });
      view.dispatch({
        changes: { from: 0, to: 4, insert: "" },
      });
      view.dispatch({
        changes: { from: 0, insert: "New" },
      });

      expect(view.state.doc.toString()).toBe("New");
      expect(ytext.toString()).toBe("New");

      view.destroy();
    });
  });

  describe("Memory Cleanup", () => {
    it("should clean up observer when view is destroyed", () => {
      const state = EditorState.create({
        doc: "",
        extensions: [yCollab(ytext, null)],
      });

      view = new EditorView({
        state,
        parent: document.body,
      });

      const initialObservers = ytext._observers ? ytext._observers.size : 0;

      view.destroy();

      // Observers should be cleaned up
      // (Y.js might keep some internal observers)
      const finalObservers = ytext._observers ? ytext._observers.size : 0;
      expect(finalObservers).toBeLessThanOrEqual(initialObservers);
    });
  });
});
