import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";

/**
 * CodeMirror 6 composable for plain text editing with Y.js integration
 *
 * @param {Object} options
 * @param {Ref} options.container - ref to DOM element for editor
 * @param {Ref} options.initialContent - ref to initial document content
 * @param {Function} options.onUpdate - callback when content changes
 * @param {Boolean} options.readOnly - whether editor is read-only (default: false)
 * @returns {Object} { view, isReady, destroy }
 */
export function useCodeMirror({ container, initialContent, onUpdate, readOnly = false }) {
  const view = ref(null);
  const isReady = ref(false);

  const createEditor = () => {
    if (!container.value) {
      console.warn("useCodeMirror: container ref not ready");
      return;
    }

    const startState = EditorState.create({
      doc: initialContent?.value || "",
      extensions: [
        basicSetup,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onUpdate) {
            onUpdate(update.state.doc.toString());
          }
        }),
        EditorView.editable.of(!readOnly),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-scroller": {
            fontFamily: '"Source Code Pro", monospace',
            overflow: "auto",
          },
          ".cm-content": {
            padding: "16px",
            minHeight: "100%",
          },
        }),
      ],
    });

    view.value = new EditorView({
      state: startState,
      parent: container.value,
    });

    isReady.value = true;
  };

  const destroy = () => {
    if (view.value) {
      view.value.destroy();
      view.value = null;
      isReady.value = false;
    }
  };

  // Watch for external content changes (e.g., from Y.js sync)
  // Only update if content differs to avoid cursor jumping
  watch(
    () => initialContent?.value,
    (newContent) => {
      if (!view.value || !isReady.value) return;

      const currentDoc = view.value.state.doc.toString();
      if (currentDoc !== newContent && newContent !== undefined) {
        view.value.dispatch({
          changes: {
            from: 0,
            to: view.value.state.doc.length,
            insert: newContent,
          },
        });
      }
    }
  );

  onMounted(() => {
    createEditor();
  });

  onBeforeUnmount(() => {
    destroy();
  });

  return {
    view,
    isReady,
    destroy,
  };
}
