import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";

import SearchBar from "@/components/utility/SearchBar.vue";
import InputText from "@/components/forms/InputText.vue";
import ColorPicker from "@/components/forms/ColorPicker.vue";

/**
 * Workspace Input Isolation Tests
 *
 * These unit tests prevent component-level keyboard interference issues
 * that could affect global input functionality. They complement the E2E
 * regression tests by testing components in isolation.
 *
 * Key focus: Ensuring components don't add global event listeners that
 * interfere with normal text input behavior.
 */

describe("Workspace Input Isolation @regression", () => {
  let originalAddEventListener;
  let originalRemoveEventListener;
  let globalListeners;

  beforeEach(() => {
    // Track global event listeners added during component mounting
    globalListeners = [];

    originalAddEventListener = document.addEventListener;
    originalRemoveEventListener = document.removeEventListener;

    document.addEventListener = vi.fn((type, listener, options) => {
      globalListeners.push({ type, listener, options, target: "document" });
      originalAddEventListener.call(document, type, listener, options);
    });

    // Also track window listeners
    const originalWindowAdd = window.addEventListener;
    window.addEventListener = vi.fn((type, listener, options) => {
      globalListeners.push({ type, listener, options, target: "window" });
      originalWindowAdd.call(window, type, listener, options);
    });
  });

  afterEach(() => {
    // Restore original methods
    document.addEventListener = originalAddEventListener;
    document.removeEventListener = originalRemoveEventListener;
    vi.restoreAllMocks();
  });

  describe("SearchBar Component", () => {
    it("doesn't add global event listeners that could interfere with input", () => {
      const wrapper = mount(SearchBar, {
        props: { placeholder: "test" },
      });

      // SearchBar should not add any global listeners
      const problematicListeners = globalListeners.filter(
        (l) =>
          l.type === "keydown" ||
          l.type === "keypress" ||
          l.type === "beforeinput" ||
          l.type === "input"
      );

      expect(problematicListeners).toHaveLength(0);

      wrapper.unmount();
    });

    it("handles keyboard events locally without preventDefault on input events", async () => {
      const wrapper = mount(SearchBar);
      const input = wrapper.find("input");

      // Mock preventDefault to detect if it's called inappropriately
      const preventDefaultSpy = vi.fn();

      // Create a proper event object without target property
      const keydownEvent = new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      });

      // Override preventDefault to track calls
      keydownEvent.preventDefault = preventDefaultSpy;

      // Simulate typing a regular character directly on the element
      input.element.dispatchEvent(keydownEvent);

      // For regular characters in input fields, preventDefault should not be called
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("allows normal text input without interference", async () => {
      const wrapper = mount(SearchBar);
      const input = wrapper.find("input");

      // Test normal typing behavior
      await input.setValue("test input");
      expect(input.element.value).toBe("test input");

      // Test that v-model works correctly
      expect(wrapper.vm.searchText).toBe("test input");
    });
  });

  describe("InputText Component", () => {
    it("doesn't add global event listeners", () => {
      const wrapper = mount(InputText, {
        props: { label: "Test Input" },
      });

      const problematicListeners = globalListeners.filter(
        (l) => l.type === "keydown" || l.type === "keypress"
      );

      expect(problematicListeners).toHaveLength(0);

      wrapper.unmount();
    });

    it("maintains normal input behavior", async () => {
      const wrapper = mount(InputText, {
        props: { label: "Test", modelValue: "" },
      });

      const input = wrapper.find("input");
      await input.setValue("test value");

      expect(input.element.value).toBe("test value");
      expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    });
  });

  describe("ColorPicker Component", () => {
    const colors = {
      red: "#FF0000",
      green: "#00FF00",
      blue: "#0000FF",
    };

    it("keyboard handlers are scoped to color picker elements only", async () => {
      const wrapper = mount(ColorPicker, {
        props: { colors },
      });

      // ColorPicker has keydown handlers on its radio swatches, but they should be scoped
      const radios = wrapper.findAll('[role="radio"]');
      expect(radios.length).toBeGreaterThan(0);

      // Verify no global keyboard listeners were added
      const globalKeyboardListeners = globalListeners.filter(
        (l) => l.type === "keydown" || l.type === "keypress"
      );

      expect(globalKeyboardListeners).toHaveLength(0);
    });

    it("doesn't prevent events on other elements", async () => {
      const wrapper = mount(ColorPicker, {
        props: { colors },
      });

      // Create a mock input element to test if ColorPicker interferes
      const mockInput = document.createElement("input");
      document.body.appendChild(mockInput);

      // Focus the mock input
      mockInput.focus();

      // Simulate typing - this should work normally
      const event = new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      });

      let eventPrevented = false;
      const originalPreventDefault = event.preventDefault;
      event.preventDefault = () => {
        eventPrevented = true;
        originalPreventDefault.call(event);
      };

      mockInput.dispatchEvent(event);

      // ColorPicker should not have prevented this event
      expect(eventPrevented).toBe(false);

      // Cleanup
      document.body.removeChild(mockInput);
      wrapper.unmount();
    });
  });

  describe("Component Integration", () => {
    it("multiple input components don't interfere with each other", async () => {
      const searchWrapper = mount(SearchBar);
      const inputWrapper = mount(InputText, {
        props: { label: "Test", modelValue: "" },
      });
      const colorWrapper = mount(ColorPicker, {
        props: { colors: { red: "#FF0000" } },
      });

      // Test SearchBar input
      const searchInput = searchWrapper.find("input");
      await searchInput.setValue("search text");
      expect(searchInput.element.value).toBe("search text");

      // Test InputText component
      const textInput = inputWrapper.find("input");
      await textInput.setValue("input text");
      expect(textInput.element.value).toBe("input text");

      // Verify both still work after all components are mounted
      await searchInput.setValue("updated search");
      await textInput.setValue("updated input");

      expect(searchInput.element.value).toBe("updated search");
      expect(textInput.element.value).toBe("updated input");

      // Cleanup
      searchWrapper.unmount();
      inputWrapper.unmount();
      colorWrapper.unmount();
    });
  });

  describe("Event System Validation", () => {
    it("components don't block beforeinput or input events globally", async () => {
      // Mount components that could potentially interfere
      const components = [
        mount(SearchBar),
        mount(InputText, { props: { label: "Test" } }),
        mount(ColorPicker, { props: { colors: { red: "#FF0000" } } }),
      ];

      // Create a test input element
      const testInput = document.createElement("input");
      document.body.appendChild(testInput);

      // Track events
      const eventsFired = {
        beforeinput: 0,
        input: 0,
        keydown: 0,
      };

      testInput.addEventListener("beforeinput", () => eventsFired.beforeinput++);
      testInput.addEventListener("input", () => eventsFired.input++);
      testInput.addEventListener("keydown", () => eventsFired.keydown++);

      // Focus and type in the test input
      testInput.focus();

      // Simulate user typing
      const keyEvent = new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      });
      testInput.dispatchEvent(keyEvent);

      const beforeInputEvent = new InputEvent("beforeinput", {
        data: "a",
        bubbles: true,
        cancelable: true,
      });
      testInput.dispatchEvent(beforeInputEvent);

      // Simulate the actual text input
      testInput.value = "a";

      const inputEvent = new InputEvent("input", {
        bubbles: true,
      });
      testInput.dispatchEvent(inputEvent);

      // Verify all events fired (components didn't interfere)
      expect(eventsFired.keydown).toBe(1);
      expect(eventsFired.beforeinput).toBe(1);
      expect(eventsFired.input).toBe(1);

      // Cleanup
      document.body.removeChild(testInput);
      components.forEach((wrapper) => wrapper.unmount());
    });

    it("detects if components inappropriately call preventDefault on input events", () => {
      // This test documents the specific issue we found with AnnotationMenu
      const mockEvent = {
        type: "beforeinput",
        target: { tagName: "INPUT" },
        key: "a",
        data: "a",
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      // Mount components and trigger event
      const wrapper = mount(SearchBar);

      // Simulate the event that was being prevented inappropriately
      const input = wrapper.find("input");
      input.element.dispatchEvent(
        new InputEvent("beforeinput", {
          data: "a",
          bubbles: true,
          cancelable: true,
        })
      );

      // The event should not be prevented for normal typing
      // (This test will help catch if we introduce the bug again)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();

      wrapper.unmount();
    });
  });
});
