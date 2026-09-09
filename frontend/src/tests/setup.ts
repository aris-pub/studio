import { config } from '@vue/test-utils';

config.global.stubs = {
  Teleport: true,
  RouterLink: true,
  RouterView: true,
  Transition: true,
  TransitionGroup: true,
};

// Silence all Vue warning messages in tests (missing components/injections, etc.)
config.global.config.warnHandler = () => {};

// Suppress console.log and console.debug during unit tests to reduce noise
// Keep console.error and console.warn for important messages
const originalConsoleLog = console.log;
const originalConsoleDebug = console.debug;
const originalConsoleWarn = console.warn;

console.log = () => {};
console.debug = () => {};

// Suppress specific Vue warnings that are noisy in tests
console.warn = (message, ...args) => {
  // Filter out Suspense experimental feature warnings
  if (typeof message === 'string' && message.includes('<Suspense> is an experimental feature')) {
    return;
  }
  // Filter out router injection warnings from tests
  if (typeof message === 'string' && message.includes('injection "Symbol(router)" not found')) {
    return;
  }
  // Call original warn for other messages
  originalConsoleWarn(message, ...args);
};

// Optional: restore console methods in case tests need them explicitly
// @ts-ignore
global.originalConsoleLog = originalConsoleLog;
// @ts-ignore  
global.originalConsoleDebug = originalConsoleDebug;
// @ts-ignore
global.originalConsoleWarn = originalConsoleWarn;
// Node 25 defines a global localStorage whose methods are missing unless the
// process was started with a storage file, and it shadows the jsdom one on both
// globalThis and window. Only patch when the environment's storage is actually
// broken, so the Node version CI uses keeps jsdom's real implementation. The
// methods go on Storage.prototype because tests spy there.
const storageIsBroken = (() => {
  try {
    // @ts-ignore
    return typeof globalThis.localStorage?.setItem !== "function";
  } catch {
    return true;
  }
})();

if (storageIsBroken && typeof Storage === "function") {
  const contents = new WeakMap<object, Map<string, string>>();
  const dataFor = (self: object) => {
    let data = contents.get(self);
    if (!data) {
      data = new Map();
      contents.set(self, data);
    }
    return data;
  };

  Object.assign(Storage.prototype, {
    getItem(key: string) {
      const data = dataFor(this);
      return data.has(String(key)) ? data.get(String(key)) : null;
    },
    setItem(key: string, value: string) {
      dataFor(this).set(String(key), String(value));
    },
    removeItem(key: string) {
      dataFor(this).delete(String(key));
    },
    clear() {
      dataFor(this).clear();
    },
    key(index: number) {
      return Array.from(dataFor(this).keys())[index] ?? null;
    },
  });
  Object.defineProperty(Storage.prototype, "length", {
    get() {
      return dataFor(this).size;
    },
    configurable: true,
  });

  for (const name of ["localStorage", "sessionStorage"] as const) {
    const storage = Object.create(Storage.prototype);
    // @ts-ignore
    const targets = new Set([globalThis, globalThis.window].filter(Boolean));
    for (const target of targets) {
      Object.defineProperty(target, name, {
        value: storage,
        configurable: true,
        writable: true,
      });
    }
  }
}
