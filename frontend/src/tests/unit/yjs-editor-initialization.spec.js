/**
 * Regression test for Y.js + CodeMirror initialization bug
 *
 * BUG: When CodeMirror is created with yCollab binding and Y.text already
 * has content, the editor was empty because yCollab doesn't apply initial state.
 *
 * FIX: Explicitly initialize EditorState with Y.text content via `doc` parameter.
 *
 * This test ensures the fix stays in place across refactors and library updates.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';

describe('Y.js + CodeMirror Initialization Regression', () => {
  let ydoc;
  let ytext;
  let view;

  beforeEach(() => {
    ydoc = new Y.Doc();
    ytext = ydoc.getText('text');
  });

  afterEach(() => {
    if (view) {
      view.destroy();
      view = null;
    }
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
    }
  });

  it('should initialize editor with Y.text content when Y.text is NOT empty', () => {
    // Setup: Y.text has content BEFORE editor is created
    const initialContent = 'Before disconnect\nDuring disconnect';
    ytext.insert(0, initialContent);

    expect(ytext.toString()).toBe(initialContent);
    expect(ytext.length).toBe(initialContent.length);

    // Create editor with yCollab binding (simulates reconnection)
    const state = EditorState.create({
      // CRITICAL: Must initialize with Y.text content
      doc: ytext.toString(),
      extensions: [
        yCollab(ytext, null, { undoManager: new Y.UndoManager(ytext) })
      ]
    });

    view = new EditorView({
      state,
      parent: document.body
    });

    // ASSERTION: Editor should have Y.text content immediately after creation
    expect(view.state.doc.toString()).toBe(initialContent);
    expect(view.state.doc.length).toBe(initialContent.length);
  });

  it('should initialize empty editor when Y.text is empty', () => {
    // Setup: Y.text is empty
    expect(ytext.toString()).toBe('');
    expect(ytext.length).toBe(0);

    // Create editor with yCollab binding
    const state = EditorState.create({
      doc: ytext.toString(), // Empty string
      extensions: [
        yCollab(ytext, null, { undoManager: new Y.UndoManager(ytext) })
      ]
    });

    view = new EditorView({
      state,
      parent: document.body
    });

    // ASSERTION: Editor should be empty
    expect(view.state.doc.toString()).toBe('');
    expect(view.state.doc.length).toBe(0);
  });

  it('should sync updates after initialization', () => {
    // Setup: Y.text has initial content
    const initialContent = 'Initial content';
    ytext.insert(0, initialContent);

    // Create editor
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        yCollab(ytext, null, { undoManager: new Y.UndoManager(ytext) })
      ]
    });

    view = new EditorView({
      state,
      parent: document.body
    });

    // Verify initial state
    expect(view.state.doc.toString()).toBe(initialContent);

    // Simulate remote update via Y.text
    ydoc.transact(() => {
      ytext.insert(ytext.length, '\nNew line');
    });

    // ASSERTION: Editor should reflect Y.text updates
    expect(view.state.doc.toString()).toBe('Initial content\nNew line');
  });

  it('REGRESSION: should NOT create empty editor when Y.text has content', () => {
    // This is the exact bug scenario: Y.text has content, but editor was empty
    ytext.insert(0, 'Content from server');

    // WITHOUT the fix (doc parameter), this would create empty editor:
    // const state = EditorState.create({
    //   extensions: [yCollab(ytext, null)]
    // });

    // WITH the fix:
    const state = EditorState.create({
      doc: ytext.toString(), // Explicitly initialize with Y.text content
      extensions: [
        yCollab(ytext, null, { undoManager: new Y.UndoManager(ytext) })
      ]
    });

    view = new EditorView({
      state,
      parent: document.body
    });

    // CRITICAL ASSERTION: Editor must NOT be empty
    expect(view.state.doc.toString()).not.toBe('');
    expect(view.state.doc.toString()).toBe('Content from server');
  });
});
