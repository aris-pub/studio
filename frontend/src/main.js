import "./assets/main.css";
import { createApp } from "vue";
import * as Sentry from "@sentry/vue";
import App from "./App.vue";
import router from "@/router";

const app = createApp(App).use(router);

// Error tracking (std-rg1qqt). No-op unless VITE_SENTRY_DSN is set, so local/CI
// builds are unaffected until a DSN is configured for a deployed environment.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  const env = (import.meta.env.VITE_ENV || "local").toLowerCase();
  const isProd = env === "prod" || env === "production";
  Sentry.init({
    app,
    dsn: sentryDsn,
    environment: env,
    release: import.meta.env.VITE_GIT_COMMIT || "dev",
    integrations: [Sentry.browserTracingIntegration({ router })],
    tracesSampleRate: isProd ? 0.05 : 1.0,
    sendDefaultPii: false, // GDPR: no user emails/IPs
    beforeSend(event) {
      // Drop events from non-deployed builds even if a DSN leaks into them.
      return env === "test" ? null : event;
    },
  });
}

const modules = import.meta.glob("./components/**/*.vue", { eager: true });
for (const path in modules) {
  const component = modules[path].default;
  const componentName = component.__name || path.split("/").pop().replace(".vue", "");
  app.component(componentName, component);
}

app.mount("#app");
