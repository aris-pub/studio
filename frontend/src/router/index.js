import { createRouter, createWebHistory } from "vue-router";
// Conditionally stub view components during unit testing to avoid .vue imports
// E2E tests need real components, so only stub for unit tests (vitest)
const isUnitTest = import.meta.env.TEST && import.meta.env.VITEST;
const LoginView = isUnitTest ? {} : () => import("@/views/login/View.vue");
const RegisterView = isUnitTest ? {} : () => import("@/views/register/View.vue");
const HomeView = isUnitTest ? {} : () => import("@/views/home/View.vue");
const WorkspaceView = isUnitTest ? {} : () => import("@/views/workspace/View.vue");
const DemoView = () => import("@/views/demo/View.vue");
const DebugButtonsView = () => import("@/views/debug/Buttons.vue");
const AccountView = isUnitTest ? {} : () => import("@/views/account/View.vue");
const SettingsView = isUnitTest ? {} : () => import("@/views/settings/View.vue");
const SettingsDocumentView = isUnitTest ? {} : () => import("@/views/settings/DocumentView.vue");
const SettingsPreferencesView = isUnitTest
  ? {}
  : () => import("@/views/settings/PreferencesView.vue");
const NotFoundView = isUnitTest ? {} : () => import("@/views/notfound/View.vue");
const VerifyEmailView = isUnitTest ? {} : () => import("@/views/verify-email/View.vue");
const ForgotPasswordView = isUnitTest ? {} : () => import("@/views/forgot-password/View.vue");
const ResetPasswordView = isUnitTest ? {} : () => import("@/views/reset-password/View.vue");

const routes = [
  { path: "/login", component: LoginView },
  { path: "/register", component: RegisterView },
  { path: "/", component: HomeView },
  { path: "/file/:file_id", component: WorkspaceView },
  { path: "/demo", component: DemoView },
  { path: "/debug/buttons", component: DebugButtonsView },
  { path: "/verify-email/:token", name: "EmailVerification", component: VerifyEmailView },
  { path: "/forgot-password", component: ForgotPasswordView },
  { path: "/reset-password/:token", component: ResetPasswordView },
  { path: "/account", component: AccountView },
  {
    path: "/settings",
    component: SettingsView,
    redirect: "/settings/preferences",
    children: [
      { path: "document", component: SettingsDocumentView },
      { path: "preferences", component: SettingsPreferencesView },
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
  const publicPages = ["/login", "/register", "/forgot-password", "/404"];
  const isVerificationRoute = to.path.startsWith("/verify-email/");
  const isResetPasswordRoute = to.path.startsWith("/reset-password/");
  const isDemoRoute = to.path.startsWith("/demo");
  const isDebugRoute = to.path.startsWith("/debug/");
  const authRequired =
    !publicPages.includes(to.path) &&
    !isVerificationRoute &&
    !isResetPasswordRoute &&
    !isDemoRoute &&
    !isDebugRoute;

  if (!authRequired) return next();

  const token = localStorage.getItem("accessToken")?.trim();
  return !token ? next("/login") : next();
});

export default router;
