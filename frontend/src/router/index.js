import { createRouter, createWebHistory } from "vue-router";
import { toast } from "@/utils/toast.js";
// Conditionally stub view components during unit testing to avoid .vue imports
// E2E tests need real components, so only stub for unit tests (vitest)
const isUnitTest = import.meta.env.TEST && import.meta.env.VITEST;
const LoginView = isUnitTest ? {} : () => import("@/views/login/View.vue");
const RegisterView = isUnitTest ? {} : () => import("@/views/register/View.vue");
const HomeView = isUnitTest ? {} : () => import("@/views/home/View.vue");
const WorkspaceView = isUnitTest ? {} : () => import("@/views/workspace/View.vue");
const DemoView = () => import("@/views/demo/View.vue");
const AccountView = isUnitTest ? {} : () => import("@/views/account/View.vue");
const AccountProfileView = isUnitTest ? {} : () => import("@/views/account/ProfileView.vue");
const AccountSecurityView = isUnitTest ? {} : () => import("@/views/account/SecurityView.vue");
const AccountNotificationsView = isUnitTest
  ? {}
  : () => import("@/views/account/NotificationsView.vue");
const SettingsView = isUnitTest ? {} : () => import("@/views/settings/View.vue");
const SettingsDocumentView = isUnitTest ? {} : () => import("@/views/settings/DocumentView.vue");
const SettingsBehaviorView = isUnitTest ? {} : () => import("@/views/settings/BehaviorView.vue");
const SettingsNotificationsView = isUnitTest
  ? {}
  : () => import("@/views/settings/NotificationsView.vue");
const NotFoundView = isUnitTest ? {} : () => import("@/views/notfound/View.vue");

const routes = [
  { path: "/login", component: LoginView },
  { path: "/register", component: RegisterView },
  { path: "/", component: HomeView },
  { path: "/file/:file_id", component: WorkspaceView },
  { path: "/demo", component: DemoView },
  {
    path: "/verify-email/:token",
    name: "EmailVerification",
    beforeEnter: async (to, from, next) => {
      const token = to.params.token;

      try {
        // Import axios here to avoid issues during testing
        const axios = (await import("axios")).default;

        // Create API instance with base URL
        const api = axios.create({
          baseURL: import.meta.env.VITE_API_BASE_URL,
        });

        await api.post(`/users/verify-email/${token}`);

        // Update user in localStorage if exists
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          user.email_verified = true;
          localStorage.setItem("user", JSON.stringify(user));
        }

        toast.success("Email verified successfully!", {
          description: "Your email address has been verified.",
        });

        next("/account/security");
      } catch (error) {
        console.error("Email verification failed", error);

        let errorMessage = "Verification failed. Please try again.";
        if (error.response?.status === 400) {
          errorMessage = "Email is already verified";
        } else if (error.response?.status === 404) {
          errorMessage = "Invalid or expired verification link";
        }

        toast.error("Email verification failed", {
          description: errorMessage,
        });

        next("/account/security");
      }
    },
  },
  {
    path: "/account",
    component: AccountView,
    redirect: "/account/profile",
    children: [
      { path: "profile", component: AccountProfileView },
      { path: "security", component: AccountSecurityView },
      { path: "notifications", component: AccountNotificationsView },
    ],
  },
  {
    path: "/settings",
    component: SettingsView,
    redirect: "/settings/document",
    children: [
      { path: "document", component: SettingsDocumentView },
      { path: "behavior", component: SettingsBehaviorView },
      { path: "notifications", component: SettingsNotificationsView },
    ],
  },
  // dedicated 404 route
  { path: "/404", name: "NotFound", component: NotFoundView },
  // catch-all route: redirect to 404
  { path: "/:pathMatch(.*)*", redirect: "/404" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const publicPages = ["/login", "/register", "/demo"];
  const isVerificationRoute = to.path.startsWith("/verify-email/");
  const authRequired = !publicPages.includes(to.path) && !isVerificationRoute;

  if (!authRequired) return next();

  const token = localStorage.getItem("accessToken")?.trim();
  return !token ? next("/login") : next();
});

export default router;
