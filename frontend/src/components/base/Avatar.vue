<script setup>
  /**
   * Avatar - Displays a user's avatar, initials, or a colored circle.
   *
   * This component fetches and displays a user's avatar image. If no avatar is available,
   * it falls back to displaying the user's initials or a colored circle based on provided user data.
   * It also supports an optional tooltip to show the user's full name on hover.
   *
   * @displayName Avatar
   * @example
   * // Basic usage with user object
   * <Avatar :user="{ id: 1, name: 'John Doe', initials: 'JD', avatar_color: '#FF5733' }" />
   *
   * @example
   * // Small size with tooltip disabled
   * <Avatar :user="{ id: 2, name: 'Jane Smith', initials: 'JS', avatar_color: '#33FF57' }" size="sm" :tooltip="false" />
   *
   * @example
   * // User with only name and avatar_color (initials derived)
   * <Avatar :user="{ id: 3, name: 'Alice', avatar_color: '#3357FF' }" />
   */
  import { inject, computed, ref, onMounted, useTemplateRef } from "vue";

  const props = defineProps({
    size: { type: String, default: "md" },
    user: { type: Object, required: true },
    tooltip: { type: Boolean, default: true },
  });
  const api = inject("api");

  const avatarUrl = ref(null);
  const hasAvatar = computed(() => !!avatarUrl.value);
  const initials = computed(() => props.user?.initials || props.user?.name?.charAt(0) || "");

  const fetchAvatar = async () => {
    if (!props.user) return;
    try {
      const response = await api.get(`/users/${props.user.id}/avatar`, {
        responseType: "blob",
      });
      if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value);
      avatarUrl.value = URL.createObjectURL(response.data);
    } catch (error) {
      avatarUrl.value = null;
    }
  };

  onMounted(() => fetchAvatar());

  const style = computed(() => {
    if (props.size === "sm") {
      return {
        backgroundColor: props.user.avatar_color,
      };
    }
    return {
      backgroundColor: hasAvatar.value ? "transparent" : props.user.avatar_color,
      backgroundImage: hasAvatar.value ? `url(${avatarUrl.value})` : "none",
    };
  });

  const selfRef = useTemplateRef("self-ref");
</script>

<template>
  <div
    ref="self-ref"
    class="av-wrapper"
    :class="[hasAvatar ? 'has-avatar' : '', `size-${props.size}`]"
    :style="style"
  >
    <span v-if="!hasAvatar && props.size !== 'sm'" class="av-name">
      {{ initials }}
    </span>
    <Tooltip v-if="tooltip" :anchor="selfRef" :content="user.name" />
  </div>
</template>

<style scoped>
  .av-wrapper {
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-size: cover;
    background-position: center;
    flex-shrink: 0;
  }

  .av-wrapper.size-sm {
    width: 12px;
    height: 12px;
  }

  .av-name {
    color: var(--white);
    font-weight: 600;
    font-size: 14px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    user-select: none;
  }

  .av-wrapper.has-avatar:not(.size-sm) {
    border: 2px solid v-bind(props.user.avatar_color);
    box-shadow: var(--shadow-soft);
  }
</style>
