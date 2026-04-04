import { describe, it, expect, vi } from "vitest";
import { shallowRef } from "vue";
import { withSetup } from "../test-utils.js";
import { useEditor } from "@/composables/useEditor.ts";

describe("useEditor", () => {
  it("returns editor with isReadOnly and setReadOnly methods", () => {
    const { result } = withSetup(() => useEditor(), {
      provide: {
        cmView: shallowRef(null),
        readOnlyCompartment: shallowRef(null),
      },
    });

    expect(result.editor).toBeDefined();
    expect(typeof result.editor.isReadOnly).toBe("function");
    expect(typeof result.editor.setReadOnly).toBe("function");
  });

  it("isReadOnly returns false when cmView is null", () => {
    const { result } = withSetup(() => useEditor(), {
      provide: {
        cmView: shallowRef(null),
        readOnlyCompartment: shallowRef(null),
      },
    });

    expect(result.editor.isReadOnly()).toBe(false);
  });

  it("isReadOnly reads from EditorState.readOnly", () => {
    const mockView = { state: { readOnly: true } };
    const { result } = withSetup(() => useEditor(), {
      provide: {
        cmView: shallowRef(mockView),
        readOnlyCompartment: shallowRef(null),
      },
    });

    expect(result.editor.isReadOnly()).toBe(true);
  });

  it("setReadOnly dispatches reconfigure effect", () => {
    const mockReconfigure = vi.fn(() => ({ type: "reconfigure" }));
    const mockDispatch = vi.fn();
    const mockView = {
      state: { readOnly: false },
      dispatch: mockDispatch,
    };
    const mockCompartment = { reconfigure: mockReconfigure };

    const { result } = withSetup(() => useEditor(), {
      provide: {
        cmView: shallowRef(mockView),
        readOnlyCompartment: shallowRef(mockCompartment),
      },
    });

    result.editor.setReadOnly(true);

    expect(mockReconfigure).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith({
      effects: { type: "reconfigure" },
    });
  });

  it("setReadOnly is a no-op when cmView is null", () => {
    const { result } = withSetup(() => useEditor(), {
      provide: {
        cmView: shallowRef(null),
        readOnlyCompartment: shallowRef(null),
      },
    });

    expect(() => result.editor.setReadOnly(true)).not.toThrow();
  });

  it("reflects updated cmView ref value", () => {
    const cmViewRef = shallowRef(null);
    const { result } = withSetup(() => useEditor(), {
      provide: {
        cmView: cmViewRef,
        readOnlyCompartment: shallowRef(null),
      },
    });

    expect(result.editor.isReadOnly()).toBe(false);

    cmViewRef.value = { state: { readOnly: true } };
    expect(result.editor.isReadOnly()).toBe(true);
  });
});
