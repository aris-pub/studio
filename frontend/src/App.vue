<script setup>
  import { ref, computed, provide, onMounted } from "vue";
  import { useRouter } from "vue-router";
  import { breakpointsTailwind, useBreakpoints } from "@vueuse/core";
  import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts.js";
  import { createFileStore } from "@/store/FileStore.js";
  import { getLogger } from "@/utils/logger.js";
  import axios from "axios";

  const logger = getLogger("App");

  // Create API instance with base URL and error handling
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 10000,
  });

  logger.info("API instance created", { baseURL: import.meta.env.VITE_API_BASE_URL });

  // Add access token to every request
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const userStr = localStorage.getItem("user");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      logger.debug("Added auth token to request", { url: config.url });
    }
    return config;
  });

  let isRefreshing = false;
  let failedQueue = [];

  const processQueue = (error, token = null) => {
    failedQueue.forEach((callback) => callback());
    failedQueue = [];
  };

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        localStorage.getItem("refreshToken")
      ) {
        originalRequest._retry = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const refreshToken = localStorage.getItem("refreshToken");

            const response = await api.post("/refresh", {
              refresh_token: refreshToken,
            });

            const newAccessToken = response.data.access_token;

            localStorage.setItem("accessToken", newAccessToken);
            api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;
            isRefreshing = false;
            processQueue(null, newAccessToken);

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            isRefreshing = false;
            processQueue(refreshError, null);
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("user");

            window.location.href = "/login";
            return Promise.reject(refreshError);
          }
        } else {
          return new Promise((resolve, reject) => {
            failedQueue.push(() => {
              originalRequest.headers.Authorization = `Bearer ${localStorage.getItem("accessToken")}`;
              resolve(api(originalRequest));
            });
          });
        }
      } else if (error.response?.status === 401) {
        // Check if this is a password validation error that should not trigger logout
        const isPasswordValidationError = originalRequest?.url?.includes("/change-password");

        if (isPasswordValidationError) {
          // Let the error pass through to component error handling
          // Do NOT redirect to login for password validation failures
        } else {
          // Check if we're on a public route that shouldn't redirect to login
          const currentPath = window.location.pathname;
          const publicPages = ["/login", "/register", "/demo"];
          const isVerificationRoute = currentPath.startsWith("/verify-email/");
          const isPublicRoute = publicPages.includes(currentPath) || isVerificationRoute;

          if (isPublicRoute) {
            // Just clean storage but don't redirect
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("user");
          } else {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("user");
            window.location.href = "/login";
          }
        }
      }

      if (!(error.response?.status === 404 && error.config?.url?.includes("/avatar"))) {
        logger.apiError(error.config?.url || "unknown", error);
      }
      return Promise.reject(error);
    }
  );
  provide("api", api);

  // Load RSM CSS
  const rsmLink = document.createElement("link");
  rsmLink.rel = "stylesheet";
  rsmLink.href = `${api.defaults.baseURL}/static/rsm.css`;
  document.head.appendChild(rsmLink);

  // Load design assets CSS
  const designAssets = ["typography.css", "components.css", "layout.css", "variables.css"];
  designAssets.forEach((filename) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${api.defaults.baseURL}/design-assets/css/${filename}`;
    document.head.appendChild(link);
  });

  // Provide viewport info
  const breakpoints = useBreakpoints({ xs: 425, ...breakpointsTailwind });
  provide("breakpoints", breakpoints);

  const xsMode = computed(() => breakpoints.smallerOrEqual("xs").value);
  provide("xsMode", xsMode);

  // Enhanced mobile detection with E2E test reliability
  const mobileMode = computed(() => {
    const isMobile = breakpoints.smallerOrEqual("sm").value;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;

    // Enhanced logging for debugging in E2E tests
    if (import.meta.env.VITE_ENV === "DEV" || import.meta.env.NODE_ENV === "test") {
      console.log(
        `[Mobile Detection] isMobile: ${isMobile}, viewport: ${viewportWidth}px, breakpoint sm: 640px`
      );
    }

    return isMobile;
  });
  provide("mobileMode", mobileMode);

  // Enhanced debugging exposure for E2E tests
  if (typeof window !== "undefined") {
    window.mobileMode = mobileMode;
    window.breakpoints = breakpoints;

    // Force mobile detection update on resize for E2E tests
    window.addEventListener("resize", () => {
      // Trigger reactivity update
      setTimeout(() => {
        if (import.meta.env.VITE_ENV === "DEV" || import.meta.env.NODE_ENV === "test") {
          console.log(
            `[Mobile Detection] Resize detected: ${window.innerWidth}px, mobile: ${mobileMode.value}`
          );
        }
      }, 100);
    });

    // Expose manual mobile detection for E2E test control
    window.debugMobileDetection = () => {
      return {
        mobileMode: mobileMode.value,
        viewportWidth: window.innerWidth,
        breakpointSm: 640,
        breakpointActive: breakpoints.active().value,
        allBreakpoints: breakpoints,
      };
    };
  }

  // Must create these here as they will be populated by the login view but need to be
  // available to other views.
  const user = ref(null);
  const fileStore = ref(null);
  const router = useRouter();

  // Function to refresh user data from backend
  const refreshUser = async () => {
    if (!user.value) return;

    try {
      const response = await api.get(`/users/${user.value.id}`);
      const updatedUser = response.data;

      // Update user ref
      user.value = updatedUser;

      // Update localStorage
      localStorage.setItem("user", JSON.stringify(updatedUser));

      logger.info("User data refreshed successfully");
    } catch (error) {
      logger.error("Failed to refresh user data", error);
    }
  };

  // App-wide loading state
  const isAppLoading = ref(true);

  // Initialize authentication state on app mount
  onMounted(async () => {
    logger.info("Starting app initialization");
    const startTime = performance.now();

    try {
      const token = localStorage.getItem("accessToken");
      const storedUser = JSON.parse(localStorage.getItem("user"));

      // Check if we're on a public route that shouldn't require authentication
      const currentPath = window.location.pathname;
      const publicPages = ["/login", "/register", "/demo"];
      const isVerificationRoute = currentPath.startsWith("/verify-email/");
      const isPublicRoute = publicPages.includes(currentPath) || isVerificationRoute;

      if (token && storedUser && !isPublicRoute) {
        logger.info("Found existing auth credentials for protected route", {
          userId: storedUser.id,
          email: storedUser.email,
          currentPath,
        });
        user.value = storedUser;

        try {
          logger.debug("Creating FileStore instance", { userId: storedUser.id });
          fileStore.value = createFileStore(api, user.value);
          logger.debug("FileStore created successfully", {
            hasFileStore: !!fileStore.value,
            storeType: typeof fileStore.value,
          });

          logger.debug("Loading user files and tags");
          await fileStore.value.loadFiles();
          logger.debug("Files loaded", { filesCount: fileStore.value.files?.length || 0 });

          await fileStore.value.loadTags();
          logger.debug("Tags loaded", { tagsCount: fileStore.value.tags?.length || 0 });

          logger.info("App initialization completed successfully", {
            userId: storedUser.id,
            filesCount: fileStore.value.files?.length || 0,
            tagsCount: fileStore.value.tags?.length || 0,
          });
        } catch (storeError) {
          logger.error("FileStore initialization or data loading failed", {
            error: storeError.message,
            stack: storeError.stack,
            userId: storedUser.id,
            hasToken: !!token,
            hasUser: !!user.value,
            hasFileStore: !!fileStore.value,
          });
          // Keep the user logged in but without store
          logger.warn("Continuing without FileStore due to initialization failure");
        }
      } else if (isPublicRoute) {
        logger.info("Public route detected, skipping authenticated initialization", {
          currentPath,
          hasToken: !!token,
          hasUser: !!storedUser,
        });
        // Don't set user or create fileStore for public routes
      } else {
        logger.info("No auth credentials found, cleaning storage");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      }
    } catch (error) {
      logger.error("App initialization failed", {
        error: error.message,
        stack: error.stack,
        hasToken: !!localStorage.getItem("accessToken"),
        hasUser: !!localStorage.getItem("user"),
      });
    } finally {
      const duration = performance.now() - startTime;
      logger.performance("App initialization", duration);
      isAppLoading.value = false;
    }
  });

  // Handle authentication redirects after router is ready
  router.beforeResolve((to, from, next) => {
    const token = localStorage.getItem("accessToken");
    let storedUser = null;
    try {
      const userItem = localStorage.getItem("user");
      storedUser = userItem ? JSON.parse(userItem) : null;
    } catch (e) {
      console.warn("[App Guard] Invalid user data in localStorage, clearing:", e);
      localStorage.removeItem("user");
      storedUser = null;
    }
    const publicPages = ["/login", "/register", "/demo"];
    const isVerificationRoute = to.path.startsWith("/verify-email/");

    // If user is not authenticated and trying to access a protected page
    if (!token && !storedUser && !publicPages.includes(to.path) && !isVerificationRoute) {
      next("/login");
    } else {
      next();
    }
  });
  provide("user", user);
  provide("refreshUser", refreshUser);
  provide("fileStore", fileStore);

  const isDev = import.meta.env.VITE_ENV === "DEV";
  provide("isDev", isDev);

  // Determine which clone this is based on backend port
  const getCloneInfo = () => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    const portMatch = apiUrl.match(/:(\d+)/);
    const port = portMatch ? parseInt(portMatch[1]) : undefined;
    return `LOCAL:${port}`;
  };

  const cloneInfo = getCloneInfo();

  // Shortcuts modal
  const showShortcutsModal = ref(false);
  useKeyboardShortcuts(
    {
      "?": {
        fn: () => (showShortcutsModal.value = !showShortcutsModal.value),
        description: "Show keyboard shortcuts help",
      },
    },
    true,
    "Global"
  );

  // Main sidebar collapsed state - here only because it's shared by multiple views
  const sidebarIsCollapsed = ref(false);
  provide("sidebarIsCollapsed", sidebarIsCollapsed);
</script>

<template>
  <div v-if="isAppLoading" class="app-loading">
    <LoadingSpinner size="large" message="Loading Aris..." />
  </div>
  <template v-else>
    <RouterView :class="`bp-${breakpoints.active().value}`" />
    <div v-if="isDev" id="env">{{ cloneInfo }}</div>

    <ModalShortcuts v-if="showShortcutsModal" @close="showShortcutsModal = false" />
  </template>
</template>

<style>
  body {
    background-color: var(--gray-75);
  }

  #app {
    background-color: var(--extra-light);
    display: flex;
    height: 100%;
    margin: 0 auto;
    border-radius: 24px;
    font-family: "Source Sans 3", sans-serif;
    font-weight: var(--weight-regular);
    font-size: 16px;
    line-height: 1.25;
    color: var(--extra-dark);
  }

  #env {
    position: fixed;
    bottom: 0px;
    right: 0px;
    color: var(--dark);
    background-color: var(--green-100);
    opacity: 0.3;
    padding: 4px;
    border-radius: 16px;
    z-index: 999;
    pointer-events: none;
  }

  .app-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    background-color: var(--extra-light);
  }
</style>
