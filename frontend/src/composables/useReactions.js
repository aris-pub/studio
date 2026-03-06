import { ref } from "vue";

export function useReactions(fileId, api) {
  const reactions = ref([]);
  const loading = ref(false);

  async function fetchReactions() {
    if (!fileId.value) return;
    loading.value = true;
    try {
      const response = await api.get("/reactions/", { params: { file_id: fileId.value } });
      reactions.value = response.data;
    } catch (error) {
      console.error("Failed to fetch reactions:", error);
    } finally {
      loading.value = false;
    }
  }

  async function upsertReaction(nodeId, reactionType) {
    const response = await api.put("/reactions/", {
      file_id: fileId.value,
      node_id: nodeId,
      reaction_type: reactionType,
    });
    const idx = reactions.value.findIndex((r) => r.node_id === nodeId);
    if (idx !== -1) {
      reactions.value[idx] = response.data;
    } else {
      reactions.value.push(response.data);
    }
    return response.data;
  }

  async function deleteReaction(nodeId) {
    await api.delete("/reactions/", { params: { file_id: fileId.value, node_id: nodeId } });
    reactions.value = reactions.value.filter((r) => r.node_id !== nodeId);
  }

  return {
    reactions,
    loading,
    fetchReactions,
    upsertReaction,
    deleteReaction,
  };
}
