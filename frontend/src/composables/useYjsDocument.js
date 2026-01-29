import { ref, onMounted, onBeforeUnmount } from "vue";
import * as Y from "yjs";

/**
 * Y.js document composable for CRDT-based collaborative editing
 *
 * @param {String} documentId - Unique identifier for the document/room
 * @returns {Object} { ydoc, ytext, isReady, destroy }
 */
export function useYjsDocument(documentId) {
  const ydoc = ref(null);
  const ytext = ref(null);
  const isReady = ref(false);

  const createDocument = () => {
    if (!documentId) {
      console.warn("useYjsDocument: documentId is required");
      return;
    }

    // Create Y.Doc instance
    ydoc.value = new Y.Doc();

    // Create Y.Text for document source
    // 'source' is the shared text type that will be synced across clients
    ytext.value = ydoc.value.getText("source");

    isReady.value = true;
  };

  const destroy = () => {
    if (ydoc.value) {
      ydoc.value.destroy();
      ydoc.value = null;
      ytext.value = null;
      isReady.value = false;
    }
  };

  onMounted(() => {
    createDocument();
  });

  onBeforeUnmount(() => {
    destroy();
  });

  return {
    ydoc,
    ytext,
    isReady,
    destroy,
  };
}
