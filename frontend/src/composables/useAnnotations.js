import { ref } from "vue";

const ANNOTATIONS_META_KEY = "annotations-meta";
const DEBOUNCE_MS = 300;

export function useAnnotations(fileId, api) {
  const annotations = ref([]);
  const loading = ref(false);

  let _ydoc = null;
  let _observer = null;
  let _debounceTimer = null;
  let _localChangeInProgress = false;

  async function fetchAnnotations() {
    if (!fileId.value) return;
    loading.value = true;
    try {
      const response = await api.get("/annotations/", { params: { file_id: fileId.value } });
      annotations.value = response.data;
    } catch (error) {
      console.error("Failed to fetch annotations:", error);
    } finally {
      loading.value = false;
    }
  }

  function _notifyYjs() {
    if (!_ydoc) return;
    _localChangeInProgress = true;
    const meta = _ydoc.getMap(ANNOTATIONS_META_KEY);
    meta.set("version", Date.now());
    _localChangeInProgress = false;
  }

  function _handleMetaChange(event, transaction) {
    if (transaction.local && _localChangeInProgress) return;
    if (transaction.local) return;

    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      fetchAnnotations();
    }, DEBOUNCE_MS);
  }

  function setYDoc(ydoc) {
    // Clean up previous observer
    if (_observer && _ydoc) {
      _ydoc.getMap(ANNOTATIONS_META_KEY).unobserve(_observer);
    }
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }

    _ydoc = ydoc;

    if (_ydoc) {
      _observer = _handleMetaChange;
      _ydoc.getMap(ANNOTATIONS_META_KEY).observe(_observer);
    } else {
      _observer = null;
    }
  }

  function notifyAnnotationChange() {
    _notifyYjs();
  }

  async function createAnnotation({ color, anchorData, selectedText, visibility }) {
    const payload = {
      file_id: fileId.value,
      color: color || "purple",
      anchor_data: anchorData,
      selected_text: selectedText,
    };
    if (visibility) payload.visibility = visibility;

    const response = await api.post("/annotations/", payload);
    annotations.value.push(response.data);
    _notifyYjs();
    return response.data;
  }

  async function updateAnnotation(id, data) {
    const response = await api.put(`/annotations/${id}`, data);
    const idx = annotations.value.findIndex((a) => a.id === id);
    if (idx !== -1) annotations.value[idx] = response.data;
    _notifyYjs();
    return response.data;
  }

  async function deleteAnnotation(id) {
    await api.delete(`/annotations/${id}`);
    annotations.value = annotations.value.filter((a) => a.id !== id);
    _notifyYjs();
  }

  async function addNote(annotationId, content) {
    const response = await api.post(`/annotations/${annotationId}/messages`, { content });
    const ann = annotations.value.find((a) => a.id === annotationId);
    if (ann) {
      if (!ann.messages) ann.messages = [];
      ann.messages.push(response.data);
    }
    _notifyYjs();
    return response.data;
  }

  async function updateNote(messageId, content) {
    const response = await api.put(`/annotations/messages/${messageId}`, { content });
    for (const ann of annotations.value) {
      const msg = ann.messages?.find((m) => m.id === messageId);
      if (msg) {
        Object.assign(msg, response.data);
        break;
      }
    }
    _notifyYjs();
    return response.data;
  }

  async function deleteNote(messageId) {
    await api.delete(`/annotations/messages/${messageId}`);
    for (const ann of annotations.value) {
      if (ann.messages) {
        ann.messages = ann.messages.filter((m) => m.id !== messageId);
      }
    }
    _notifyYjs();
  }

  return {
    annotations,
    loading,
    fetchAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addNote,
    updateNote,
    deleteNote,
    setYDoc,
    notifyAnnotationChange,
  };
}
