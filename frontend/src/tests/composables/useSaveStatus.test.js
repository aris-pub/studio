import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";

import { useSaveStatus } from "@/composables/useSaveStatus.js";

describe("useSaveStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(overrides = {}) {
    const isConnected = ref(overrides.connected ?? true);
    const s = useSaveStatus({
      isConnected,
      settleMs: 400,
      watchdogMs: 4000,
      checkIntervalMs: 1000,
      ...overrides,
    });
    return { isConnected, ...s };
  }

  it("starts in the saved state with no pending edits", () => {
    const { saveState } = setup();
    expect(saveState.value).toBe("saved");
  });

  it("moves to saving on a local edit", () => {
    const { saveState, noteLocalEdit } = setup();
    noteLocalEdit();
    expect(saveState.value).toBe("saving");
  });

  it("settles to saved on a persisted ack once edits have quiesced", () => {
    const { saveState, noteLocalEdit, notePersisted } = setup();
    noteLocalEdit();
    vi.advanceTimersByTime(500); // past settleMs, no interval tick yet
    notePersisted();
    expect(saveState.value).toBe("saved");
  });

  it("ignores a persisted ack that races an in-flight edit (stays saving)", () => {
    const { saveState, noteLocalEdit, notePersisted } = setup();
    noteLocalEdit();
    vi.advanceTimersByTime(100); // within settleMs, so this ack predates the edit
    notePersisted();
    expect(saveState.value).toBe("saving");
  });

  it("ignores a persisted ack when nothing is pending", () => {
    const { saveState, notePersisted } = setup();
    notePersisted();
    expect(saveState.value).toBe("saved");
  });

  it("warns (not-saving) when saving persists past the watchdog with no ack", () => {
    const { saveState, noteLocalEdit } = setup();
    noteLocalEdit();
    expect(saveState.value).toBe("saving");
    // No ack ever arrives; the warning fires on the first poll past watchdogMs
    // (4000ms), i.e. the 5000ms tick with a 1000ms poll interval.
    vi.advanceTimersByTime(5001);
    expect(saveState.value).toBe("not-saving");
  });

  it("stays saving (not a false warning) while the user keeps typing", () => {
    const { saveState, noteLocalEdit } = setup();
    // Simulate continuous typing: an edit every 500ms for 6s. The backend never
    // hits its debounce gap, so no ack arrives, but this is healthy, not a failure.
    for (let i = 0; i < 12; i++) {
      noteLocalEdit();
      vi.advanceTimersByTime(500);
    }
    expect(saveState.value).toBe("saving");
  });

  it("warns immediately when a local edit happens while the relay is offline", () => {
    const { saveState, noteLocalEdit } = setup({ connected: false });
    noteLocalEdit();
    expect(saveState.value).toBe("not-saving");
  });

  it("warns when the relay drops mid-save, then recovers on reconnect", () => {
    const { saveState, isConnected, noteLocalEdit } = setup();
    noteLocalEdit();
    expect(saveState.value).toBe("saving");

    isConnected.value = false;
    expect(saveState.value).toBe("not-saving");

    isConnected.value = true;
    expect(saveState.value).toBe("saving"); // still unsaved, hoping for an ack
  });

  it("recovers to saved after a warning once a real ack lands", () => {
    const { saveState, noteLocalEdit, notePersisted } = setup();
    noteLocalEdit();
    vi.advanceTimersByTime(5001);
    expect(saveState.value).toBe("not-saving");

    notePersisted(); // last edit was long ago -> past settle window
    expect(saveState.value).toBe("saved");
  });

  it("leaves saved alone when the relay drops with nothing pending", () => {
    const { saveState, isConnected } = setup();
    expect(saveState.value).toBe("saved");
    isConnected.value = false;
    expect(saveState.value).toBe("saved");
  });

  it("reset() clears pending state back to saved", () => {
    const { saveState, noteLocalEdit, reset } = setup();
    noteLocalEdit();
    expect(saveState.value).toBe("saving");
    reset();
    expect(saveState.value).toBe("saved");
  });
});
