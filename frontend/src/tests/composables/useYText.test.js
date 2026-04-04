import { describe, it, expect, vi } from "vitest";
import { shallowRef } from "vue";
import { withSetup } from "../test-utils.js";
import { useYText } from "@/composables/useYText.ts";

describe("useYText", () => {
  it("returns ytext and ydoc proxies", () => {
    const { result } = withSetup(() => useYText(123), {
      provide: {
        ydoc: shallowRef(null),
      },
    });

    expect(result.ytext).toBeDefined();
    expect(result.ydoc).toBeDefined();
  });

  it("ydoc proxy delegates to injected ydoc", () => {
    const mockTransact = vi.fn((cb) => cb());
    const mockDoc = {
      transact: mockTransact,
      getText: vi.fn(() => ({ insert: vi.fn(), delete: vi.fn(), length: 0 })),
    };

    const { result } = withSetup(() => useYText(123), {
      provide: {
        ydoc: shallowRef(mockDoc),
      },
    });

    result.ydoc.transact(() => {});
    expect(mockTransact).toHaveBeenCalled();
  });

  it("ytext proxy accesses getText('text') from ydoc", () => {
    const mockYText = { insert: vi.fn(), delete: vi.fn(), length: 42 };
    const mockDoc = {
      getText: vi.fn(() => mockYText),
    };

    const { result } = withSetup(() => useYText(123), {
      provide: {
        ydoc: shallowRef(mockDoc),
      },
    });

    expect(result.ytext.length).toBe(42);
    expect(mockDoc.getText).toHaveBeenCalledWith("text");
  });

  it("ydoc proxy throws when ydoc ref is null", () => {
    const { result } = withSetup(() => useYText(123), {
      provide: {
        ydoc: shallowRef(null),
      },
    });

    expect(() => result.ydoc.transact).toThrow("Y.Doc not initialized");
  });

  it("ytext proxy throws when ydoc ref is null", () => {
    const { result } = withSetup(() => useYText(123), {
      provide: {
        ydoc: shallowRef(null),
      },
    });

    expect(() => result.ytext.length).toThrow("Y.Text not initialized");
  });

  it("reflects updated ydoc ref value", () => {
    const ydocRef = shallowRef(null);
    const { result } = withSetup(() => useYText(123), {
      provide: {
        ydoc: ydocRef,
      },
    });

    expect(() => result.ydoc.transact).toThrow("Y.Doc not initialized");

    const mockDoc = {
      transact: vi.fn((cb) => cb()),
      getText: vi.fn(() => ({ insert: vi.fn(), delete: vi.fn(), length: 10 })),
    };
    ydocRef.value = mockDoc;

    result.ydoc.transact(() => {});
    expect(mockDoc.transact).toHaveBeenCalled();
  });
});
