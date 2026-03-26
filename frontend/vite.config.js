import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Load .env file manually for test environment (development only)
function loadEnvFile() {
  try {
    const envPath = resolve(__dirname, "../.env");
    const envContent = readFileSync(envPath, "utf8");
    const envVars = {};

    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join("=").trim();
        }
      }
    });

    return envVars;
  } catch {
    return {};
  }
}

const envVars = loadEnvFile();

// https://vite.dev/config/
// Proxy target for the Vite dev server (runs inside Docker container).
// PROXY_API_TARGET uses Docker service name (e.g. http://backend:8000).
// Falls back to VITE_API_BASE_URL for local dev without Docker.
const proxyTarget = process.env.PROXY_API_TARGET
  || process.env.VITE_API_BASE_URL
  || envVars.VITE_API_BASE_URL
  || "http://localhost:8000";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/files/": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["jquery"],
  },
  optimizeDeps: {
    include: ["jquery", "tooltipster"],
    exclude: ["@tabler/icons-vue"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "src/tests/setup.ts",
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 8,
        minThreads: 1,
      },
    },
    fileParallelism: false,
    env: {
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || envVars.VITE_API_BASE_URL,
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/src/tests/e2e/**",
      "**/tests/e2e/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/tests/",
        "**/*.test.js",
        "**/*.spec.js",
        "dist/",
        "coverage/",
        "**/*.config.js",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
