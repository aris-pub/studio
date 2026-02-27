import { createRouter, createWebHistory } from "vue-router";
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
const VerifyEmailView = isUnitTest ? {} : () => import("@/views/verify-email/View.vue");

const routes = [
  { path: "/login", component: LoginView },
  { path: "/register", component: RegisterView },
  { path: "/", component: HomeView },
  { path: "/file/:file_id", component: WorkspaceView },
  { path: "/demo", component: DemoView },
  { path: "/verify-email/:token", name: "EmailVerification", component: VerifyEmailView },
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
  const publicPages = ["/login", "/register"];
  const isVerificationRoute = to.path.startsWith("/verify-email/");
  const isDemoRoute = to.path.startsWith("/demo");
  const authRequired = !publicPages.includes(to.path) && !isVerificationRoute && !isDemoRoute;

  if (!authRequired) return next();

  const token = localStorage.getItem("accessToken")?.trim();
  return !token ? next("/login") : next();
});

export default router;
