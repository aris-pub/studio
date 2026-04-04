import { describe, it, expect } from "vitest";
import { shallowRef, ref } from "vue";
import { withSetup } from "../test-utils.js";
import { useAwareness } from "@/composables/useAwareness.ts";

describe("useAwareness", () => {
  it("returns awareness proxy and currentUser", () => {
    const { result } = withSetup(() => useAwareness(), {
      provide: {
        awareness: shallowRef(null),
        user: ref({ id: 1, name: "Test User", email: "test@example.com" }),
      },
    });

    expect(result.awareness).toBeDefined();
    expect(result.currentUser).toBeDefined();
  });

  it("currentUser reflects injected user values", () => {
    const { result } = withSetup(() => useAwareness(), {
      provide: {
        awareness: shallowRef(null),
        user: ref({ id: 42, name: "Alice", email: "alice@test.com" }),
      },
    });

    expect(result.currentUser.id).toBe(42);
    expect(result.currentUser.name).toBe("Alice");
  });

  it("awareness proxy delegates to awareness instance", () => {
    const mockAwareness = {
      getStates: () => new Map([[1, { user: { id: 1, name: "User 1" } }]]),
      setLocalStateField: () => {},
    };

    const { result } = withSetup(() => useAwareness(), {
      provide: {
        awareness: shallowRef(mockAwareness),
        user: ref({ id: 1, name: "User 1", email: "u1@test.com" }),
      },
    });

    const states = result.awareness.getStates();
    expect(states).toBeInstanceOf(Map);
    expect(states.size).toBe(1);
  });

  it("awareness proxy throws when awareness ref is null", () => {
    const { result } = withSetup(() => useAwareness(), {
      provide: {
        awareness: shallowRef(null),
        user: ref({ id: 1, name: "User", email: "u@test.com" }),
      },
    });

    expect(() => result.awareness.getStates()).toThrow("Awareness not initialized");
  });

  it("currentUser falls back to email when name is missing", () => {
    const { result } = withSetup(() => useAwareness(), {
      provide: {
        awareness: shallowRef(null),
        user: ref({ id: 1, name: null, email: "fallback@test.com" }),
      },
    });

    expect(result.currentUser.name).toBe("fallback@test.com");
  });
});
