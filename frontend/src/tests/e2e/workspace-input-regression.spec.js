import { test, expect } from "./fixtures.js";
import { TIMEOUTS } from "./utils/timeout-constants.js";

/**
 * Workspace Input Regression Tests
 *
 * CRITICAL: These tests prevent regression of the keyboard input interference
 * issue discovered in July 2025 where AnnotationMenu component was preventing
 * ALL text input in workspace views.
 *
 * This test suite ensures that:
 * 1. All input fields accept keyboard input
 * 2. Component interference is detected early
 * 3. Text composition works properly (not just focus)
 * 4. Global keyboard listeners don't block input events
 */

test.describe("Input Regression Tests @core @desktop-only", () => {
  test("basic input functionality works without global interference", async ({ page }) => {
    // Navigate to demo page (always available)
    await page.goto("/demo/content", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    // Create a test input to verify keyboard events work globally
    await page.evaluate(() => {
      const testInput = document.createElement("input");
      testInput.setAttribute("data-testid", "regression-test-input");
      testInput.placeholder = "Regression test input";
      testInput.style.position = "fixed";
      testInput.style.top = "10px";
      testInput.style.left = "10px";
      testInput.style.zIndex = "99999";
      testInput.style.padding = "8px";
      testInput.style.border = "2px solid red";
      testInput.style.background = "yellow";
      testInput.style.fontSize = "14px";
      document.body.appendChild(testInput);
    });

    const testInput = page.locator('[data-testid="regression-test-input"]');
    await expect(testInput).toBeVisible();

    // Focus the input
    await testInput.click();
    await expect(testInput).toBeFocused();

    // CRITICAL: Type text and verify it appears (this was broken with AnnotationMenu)
    const testText = "regression test input works";
    await testInput.type(testText);
    await expect(testInput).toHaveValue(testText);

    // Test backspace functionality
    await page.keyboard.press("Backspace");
    await expect(testInput).toHaveValue(testText.slice(0, -1));

    // Test special characters and symbols
    await testInput.clear();
    await testInput.type("!@#$%^&*()_+-=[]{}|;:,.<>?");
    await expect(testInput).toHaveValue("!@#$%^&*()_+-=[]{}|;:,.<>?");

    // Test clear and new input
    await testInput.clear();
    await testInput.type("final test");
    await expect(testInput).toHaveValue("final test");
  });

  test("rapid typing doesn't get lost due to event interference", async ({ page }) => {
    await page.goto("/demo/content", { waitUntil: "networkidle" });

    // Create test input
    await page.evaluate(() => {
      const testInput = document.createElement("input");
      testInput.setAttribute("data-testid", "rapid-test-input");
      testInput.style.position = "fixed";
      testInput.style.top = "50px";
      testInput.style.left = "10px";
      testInput.style.zIndex = "99999";
      testInput.style.padding = "8px";
      testInput.style.border = "2px solid blue";
      testInput.style.background = "lightblue";
      document.body.appendChild(testInput);
    });

    const testInput = page.locator('[data-testid="rapid-test-input"]');
    await testInput.click();

    // Test rapid typing (this could reveal timing-based interference issues)
    const rapidText = "thequickbrownfoxjumpsoverthelazydog";
    await testInput.type(rapidText, { delay: 10 }); // Very fast typing

    await expect(testInput).toHaveValue(rapidText);

    // Test rapid backspacing
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Backspace");
    }

    const expectedValue = rapidText.slice(0, -10);
    await expect(testInput).toHaveValue(expectedValue);
  });

  test("browser input events fire correctly without interference", async ({ page }) => {
    await page.goto("/demo/content", { waitUntil: "networkidle" });

    // Set up event listeners to detect if events are being blocked
    await page.evaluate(() => {
      window.inputEventsFired = {
        beforeinput: 0,
        input: 0,
        keydown: 0,
      };

      const testInput = document.createElement("input");
      testInput.setAttribute("data-testid", "event-test-input");
      testInput.style.position = "fixed";
      testInput.style.top = "90px";
      testInput.style.left = "10px";
      testInput.style.zIndex = "99999";
      testInput.style.padding = "8px";
      testInput.style.border = "2px solid green";
      testInput.style.background = "lightgreen";
      document.body.appendChild(testInput);

      testInput.addEventListener("beforeinput", () => window.inputEventsFired.beforeinput++);
      testInput.addEventListener("input", () => window.inputEventsFired.input++);
      testInput.addEventListener("keydown", () => window.inputEventsFired.keydown++);
    });

    const testInput = page.locator('[data-testid="event-test-input"]');
    await testInput.click();
    await testInput.type("event test");

    // Verify events fired (this was the core issue with AnnotationMenu)
    const eventCounts = await page.evaluate(() => window.inputEventsFired);

    expect(eventCounts.keydown).toBeGreaterThan(0);
    expect(eventCounts.beforeinput).toBeGreaterThan(0);
    expect(eventCounts.input).toBeGreaterThan(0);

    // Verify text actually appeared
    await expect(testInput).toHaveValue("event test");
  });

  test("focus management works correctly without interference", async ({ page }) => {
    await page.goto("/demo/content", { waitUntil: "networkidle" });

    // Create multiple inputs to test focus management
    await page.evaluate(() => {
      const input1 = document.createElement("input");
      input1.setAttribute("data-testid", "focus-test-input-1");
      input1.style.position = "fixed";
      input1.style.top = "130px";
      input1.style.left = "10px";
      input1.style.padding = "8px";
      input1.style.border = "2px solid purple";
      document.body.appendChild(input1);

      const input2 = document.createElement("input");
      input2.setAttribute("data-testid", "focus-test-input-2");
      input2.style.position = "fixed";
      input2.style.top = "170px";
      input2.style.left = "10px";
      input2.style.padding = "8px";
      input2.style.border = "2px solid orange";
      document.body.appendChild(input2);
    });

    const input1 = page.locator('[data-testid="focus-test-input-1"]');
    const input2 = page.locator('[data-testid="focus-test-input-2"]');

    // Test focus switching between inputs
    await input1.click();
    await expect(input1).toBeFocused();
    await input1.type("first");
    await expect(input1).toHaveValue("first");

    await input2.click();
    await expect(input2).toBeFocused();
    await expect(input1).not.toBeFocused();
    await input2.type("second");
    await expect(input2).toHaveValue("second");

    // Verify first input still has its value
    await expect(input1).toHaveValue("first");

    // Test clicking back to first input
    await input1.click();
    await expect(input1).toBeFocused();
    await input1.type(" continued");
    await expect(input1).toHaveValue("first continued");
  });

  test("international characters and symbols work correctly", async ({ page }) => {
    await page.goto("/demo/content", { waitUntil: "networkidle" });

    await page.evaluate(() => {
      const testInput = document.createElement("input");
      testInput.setAttribute("data-testid", "international-test-input");
      testInput.style.position = "fixed";
      testInput.style.top = "210px";
      testInput.style.left = "10px";
      testInput.style.padding = "8px";
      testInput.style.border = "2px solid teal";
      testInput.style.width = "300px";
      document.body.appendChild(testInput);
    });

    const testInput = page.locator('[data-testid="international-test-input"]');
    await testInput.click();

    // Test various international characters and symbols
    const testCases = [
      "résumé café", // French accents
      "naïve coöp", // Diacritical marks
      "α β γ δ", // Greek letters (common in scientific text)
      "∑ ∫ ∂ ∇", // Mathematical symbols
      "€£¥₹", // Currency symbols
    ];

    for (const testCase of testCases) {
      await testInput.clear();
      await testInput.type(testCase);
      await expect(testInput).toHaveValue(testCase);
    }
  });
});

test.describe("Component Interference Detection @core", () => {
  test("page components don't globally interfere with input events", async ({ page }) => {
    // Navigate to a page that might have interfering components
    await page.goto("/demo/content", { waitUntil: "networkidle" });

    // Wait for any components to load that might interfere
    await page.waitForTimeout(TIMEOUTS.CONTENT_LOAD);

    // Create test input after components are loaded
    await page.evaluate(() => {
      const testInput = document.createElement("input");
      testInput.setAttribute("data-testid", "interference-test-input");
      testInput.style.position = "fixed";
      testInput.style.top = "250px";
      testInput.style.left = "10px";
      testInput.style.padding = "8px";
      testInput.style.border = "2px solid red";
      testInput.style.background = "pink";
      document.body.appendChild(testInput);
    });

    const testInput = page.locator('[data-testid="interference-test-input"]');
    await testInput.click();

    // Test that input works despite any loaded components
    await testInput.type("component interference test");
    await expect(testInput).toHaveValue("component interference test");
  });

  test("annotation menu component doesn't interfere when enabled", async ({ page }) => {
    // Navigate to demo workspace that should have AnnotationMenu enabled
    await page.goto("/demo/workspace", { waitUntil: "networkidle" });

    // Wait for AnnotationMenu component to potentially load
    await page.waitForTimeout(TIMEOUTS.CONTENT_LOAD);

    // Create test input to verify keyboard interference
    await page.evaluate(() => {
      const testInput = document.createElement("input");
      testInput.setAttribute("data-testid", "annotation-interference-test");
      testInput.style.position = "fixed";
      testInput.style.top = "10px";
      testInput.style.right = "10px";
      testInput.style.padding = "8px";
      testInput.style.border = "3px solid red";
      testInput.style.background = "yellow";
      testInput.style.zIndex = "99999";
      testInput.style.fontSize = "16px";
      document.body.appendChild(testInput);
    });

    const testInput = page.locator('[data-testid="annotation-interference-test"]');
    await expect(testInput).toBeVisible();
    await testInput.click();
    await expect(testInput).toBeFocused();

    // CRITICAL: This should work even when AnnotationMenu is enabled
    // If AnnotationMenu interferes, this will fail
    const testText = "annotation interference test";
    await testInput.type(testText);
    await expect(testInput).toHaveValue(testText);

    // Test that backspace works
    await page.keyboard.press("Backspace");
    await expect(testInput).toHaveValue(testText.slice(0, -1));

    // Test rapid typing (AnnotationMenu mouseup interference might affect this)
    await testInput.clear();
    await testInput.type("rapid typing test", { delay: 10 });
    await expect(testInput).toHaveValue("rapid typing test");
  });
});
