import { createApp, defineComponent, h } from "vue";

/**
 * Run a composable inside a Vue setup context with provide/inject support.
 * Returns { result, app } where result is the composable's return value.
 */
export function withSetup(composable, options = {}) {
  let result;

  const app = createApp(
    defineComponent({
      setup() {
        result = composable();
        return () => h("div");
      },
    }),
  );

  if (options.provide) {
    for (const [key, value] of Object.entries(options.provide)) {
      app.provide(key, value);
    }
  }

  app.mount(document.createElement("div"));

  return { result, app };
}
