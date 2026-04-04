/**
 * @file Unit tests for useRestoreNotification composable
 * @description Tests that awareness state changes from other users trigger toast notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shallowRef } from "vue";

// Mock toast
const mockToast = {
  info: vi.fn(),
};
vi.mock("@/utils/toast", () => ({
  toast: mockToast,
  default: mockToast,
}));

// Import after mocks
const { useRestoreNotification } = await import(
  "@/composables/useRestoreNotification"
);

/**
 * Helper: create a fake awareness object that supports on/off and getStates.
 */
function createMockAwareness(initialStates = new Map()) {
  const listeners = new Map();
  return {
    _states: initialStates,
    getStates() {
      return this._states;
    },
    getLocalState() {
      return this._states.get(0) || {};
    },
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    _emit(event, ...args) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
    _listeners: listeners,
  };
}

describe("useRestoreNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows toast when another user starts restoring", () => {
    const awareness = createMockAwareness(
      new Map([
        [0, { user: { id: 1, name: "Me" } }],
        [
          2,
          {
            user: { id: 2, name: "Alice" },
            restoring: null,
          },
        ],
      ]),
    );
    const awarenessRef = shallowRef(awareness);

    useRestoreNotification(awarenessRef, 1);

    // Simulate Alice starting a restore
    awareness._states.set(2, {
      user: { id: 2, name: "Alice" },
      restoring: 42,
    });
    awareness._emit("change", { added: [], updated: [2], removed: [] }, "local");

    expect(mockToast.info).toHaveBeenCalledTimes(1);
    expect(mockToast.info).toHaveBeenCalledWith(
      "Alice restored a previous version",
      expect.objectContaining({
        description: expect.stringContaining("updated"),
      }),
    );
  });

  it("does not show toast for own restoring state", () => {
    const awareness = createMockAwareness(
      new Map([[0, { user: { id: 1, name: "Me" }, restoring: null }]]),
    );
    const awarenessRef = shallowRef(awareness);

    useRestoreNotification(awarenessRef, 1);

    // Simulate self starting a restore
    awareness._states.set(0, {
      user: { id: 1, name: "Me" },
      restoring: 99,
    });
    awareness._emit("change", { added: [], updated: [0], removed: [] }, "local");

    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it("does not show toast when restoring transitions to null (clear)", () => {
    const awareness = createMockAwareness(
      new Map([
        [0, { user: { id: 1, name: "Me" } }],
        [
          2,
          {
            user: { id: 2, name: "Alice" },
            restoring: 42,
          },
        ],
      ]),
    );
    const awarenessRef = shallowRef(awareness);

    // Composable starts — Alice already restoring, but no transition yet
    useRestoreNotification(awarenessRef, 1);

    // Alice clears her restoring state (restore finished)
    awareness._states.set(2, {
      user: { id: 2, name: "Alice" },
      restoring: null,
    });
    awareness._emit("change", { added: [], updated: [2], removed: [] }, "local");

    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it("handles user with no user info gracefully", () => {
    const awareness = createMockAwareness(
      new Map([
        [0, { user: { id: 1, name: "Me" } }],
        [2, {}],
      ]),
    );
    const awarenessRef = shallowRef(awareness);

    useRestoreNotification(awarenessRef, 1);

    // Client 2 sets restoring but has no user info
    awareness._states.set(2, { restoring: 42 });
    awareness._emit("change", { added: [], updated: [2], removed: [] }, "local");

    expect(mockToast.info).toHaveBeenCalledTimes(1);
    expect(mockToast.info).toHaveBeenCalledWith(
      "Someone restored a previous version",
      expect.any(Object),
    );
  });

  it("cleans up listener on stop", () => {
    const awareness = createMockAwareness(
      new Map([[0, { user: { id: 1, name: "Me" } }]]),
    );
    const awarenessRef = shallowRef(awareness);

    const { stop } = useRestoreNotification(awarenessRef, 1);
    stop();

    // Simulate a change after cleanup
    awareness._states.set(2, {
      user: { id: 2, name: "Bob" },
      restoring: 10,
    });
    awareness._emit("change", { added: [2], updated: [], removed: [] }, "local");

    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it("handles late awareness (null ref initially, set later)", () => {
    const awarenessRef = shallowRef(null);
    useRestoreNotification(awarenessRef, 1);

    // No error thrown — now set awareness
    const awareness = createMockAwareness(
      new Map([[0, { user: { id: 1, name: "Me" } }]]),
    );
    awarenessRef.value = awareness;

    // Trigger Vue reactivity manually won't work in unit tests without a component,
    // but we can verify no error was thrown during setup
    expect(mockToast.info).not.toHaveBeenCalled();
  });
});
