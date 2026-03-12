<script setup>
  import { ref, inject, computed, useTemplateRef, watchEffect } from "vue";
  import { useRoute, useRouter } from "vue-router";

  /**
   * UserMenu - User account dropdown menu with mobile/desktop responsive modes
   *
   * A responsive user menu component that displays as a ContextMenu on desktop
   * and as a slide-out drawer on mobile. Provides navigation to account settings,
   * user profile, and logout functionality with proper authentication handling.
   *
   * @displayName UserMenu
   * @example
   * // Basic usage (requires user injection)
   * <UserMenu />
   *
   * @example
   * // Programmatic control
   * <UserMenu ref="userMenuRef" />
   * // userMenuRef.value.toggle()
   */

  const mobileMode = inject("mobileMode");
  const isMobile = computed(() => mobileMode?.value ?? false);
  const user = inject("user");
  const route = useRoute();
  const router = useRouter();

  // Refs for both desktop and mobile modes
  const menuRef = useTemplateRef("menu-ref");
  const isOpen = ref(false);

  const toggle = () => {
    if (isMobile.value) {
      isOpen.value = !isOpen.value;
    } else {
      menuRef.value?.toggle();
    }
  };

  const close = () => {
    if (isMobile.value) {
      isOpen.value = false;
    } else {
      // ContextMenu handles its own closing
    }
  };

  // Expose methods and state for testing and parent components
  defineExpose({
    toggle,
    close,
    get isOpen() {
      return isMobile.value ? isOpen.value : false;
    },
  });

  const navigateTo = (path) => {
    router.push(path);
    close();
  };

  const goTo = (page) => navigateTo(`/${page}`);

  const showFeedback = ref(false);

  const handleFeedback = () => {
    close();
    showFeedback.value = true;
  };

  const handleHelp = () => {
    navigateTo("/help");
  };

  const onLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    close();
    router.push("/login");
  };

  // Prevent body scroll when mobile drawer is open
  watchEffect(() => {
    if (isMobile.value && isOpen.value) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  });
</script>

<template>
  <div class="user-menu-wrapper" :class="{ mobile: isMobile, desktop: !isMobile }">
    <!-- Desktop: Context Menu -->
    <ContextMenu v-if="!isMobile" ref="menu-ref" variant="slot">
      <template #trigger="{ toggle: toggleMenu }">
        <Button kind="tertiary" data-testid="user-avatar" @click="toggleMenu">
          <Avatar :user="user" size="md" :tooltip="false" />
        </Button>
      </template>

      <!-- Account Section -->
      <ContextMenuItem icon="User" caption="Account" @click="navigateTo('/account')" />
      <Separator />

      <!-- Actions Section -->
      <ContextMenuItem icon="HelpCircle" caption="Help" @click="handleHelp" />
      <ContextMenuItem icon="MessageChatbot" caption="Feedback" @click="handleFeedback" />
      <ContextMenuItem icon="Keyboard" caption="Shortcuts" />
      <Separator />

      <!-- Logout Section -->
      <ContextMenuItem icon="Logout" caption="Logout" @click="onLogout" />
    </ContextMenu>

    <!-- Mobile: Avatar Trigger -->
    <div v-else class="avatar-trigger" data-testid="user-avatar" @click="toggle">
      <Avatar :user="user" size="md" :tooltip="false" />
    </div>

    <!-- Mobile: Drawer Overlay -->
    <div v-if="isMobile && isOpen" class="user-overlay" @click="close">
      <div class="user-drawer" :class="{ open: isOpen }" @click.stop>
        <div class="user-header">
          <Logo type="small" />
          <Button kind="tertiary" icon="X" data-testid="user-close" @click="close" />
        </div>

        <nav class="user-menu">
          <!-- Account Section -->
          <div class="user-section" data-testid="account-section">
            <div class="section-title">Account</div>
            <div
              class="user-item"
              :class="{ active: route.path === '/account' }"
              data-testid="account-profile"
              @click="navigateTo('/account')"
            >
              <Icon name="User" />
              <span>Account</span>
            </div>
          </div>

          <!-- Actions Section -->
          <div class="user-section">
            <div class="user-item" data-testid="user-help" @click="handleHelp">
              <Icon name="HelpCircle" />
              <span>Help</span>
            </div>
            <div class="user-item" data-testid="user-feedback" @click="handleFeedback">
              <Icon name="MessageChatbot" />
              <span>Feedback</span>
            </div>
            <div v-if="!isMobile" class="user-item" data-testid="user-shortcuts">
              <Icon name="Keyboard" />
              <span>Shortcuts</span>
            </div>
          </div>

          <!-- Logout Section -->
          <div class="user-section">
            <div class="user-item logout" data-testid="user-logout" @click="onLogout">
              <Icon name="LogOut" />
              <span>Logout</span>
            </div>
          </div>
        </nav>
      </div>
    </div>

    <FeedbackModal :show="showFeedback" @close="showFeedback = false" />
  </div>
</template>

<style scoped>
  .user-menu-wrapper {
    border-radius: 16px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-trigger {
    cursor: pointer;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }

  .avatar-trigger:hover {
    transform: scale(1.05);
  }

  .user-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: var(--overlay-backdrop);
    z-index: 999;
    animation: fadeIn 0.3s ease-out;
  }

  .user-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 280px;
    height: 100vh;
    background: var(--gray-50);
    border-left: 1px solid var(--gray-200);
    padding: 16px;
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .user-drawer.open {
    transform: translateX(0);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .user-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--gray-200);
  }

  .user-menu {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .user-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-title {
    font-size: 14px;
    font-weight: var(--weight-medium);
    color: var(--gray-600);
    margin-bottom: 8px;
    padding-left: 16px;
  }

  .user-item {
    --padding-inline: 16px;
    --border-left-width: var(--border-med);

    position: relative;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-block: 4px;
    border-left: var(--border-left-width) solid transparent;
    padding-left: calc(var(--padding-inline) - var(--border-left-width));
    padding-right: var(--padding-inline);
    transition: var(--transition-bg-color);
    cursor: pointer;
  }

  .user-item:hover:not(.active) {
    background-color: var(--gray-200);
    border-left-color: var(--light);
  }

  .user-item.active {
    background-color: var(--surface-primary);
    border-left-color: var(--border-action);
    box-shadow: var(--shadow-soft);
  }

  .user-item.active :deep(svg) {
    stroke-width: 2px;
    color: var(--primary-600);
  }

  .user-item.active span {
    font-weight: var(--weight-medium);
    color: var(--primary-600);
  }

  .user-item span {
    font-size: 16px;
  }

  .user-item.logout {
    color: var(--red-600);
  }

  .user-item.logout:hover {
    background-color: var(--red-50);
    border-left-color: var(--red-200);
  }

  .user-item.logout :deep(svg) {
    color: var(--red-600);
  }
</style>
