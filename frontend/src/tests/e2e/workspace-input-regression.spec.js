import { test, expect } from "./fixtures.js";

/**
 * Input Regression Tests
 *
 * Prevents regression of the keyboard input interference issue (July 2025)
 * where AnnotationMenu's global event listener blocked ALL text input.
 *
 * Uses /login (a simple page without workspace keyboard shortcuts) because
 * the bug was a GLOBAL listener — it broke input on every page, not just
 * the workspace. Testing on /login avoids false positives from the workspace's
 * intentional keyboard shortcut system.
 */

test.describe("Input Regression Tests @core @desktop-only", () => {
  test("keyboard input works without global interference", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    await page.evaluate(() => {
      const input = document.createElement("input");
      input.setAttribute("data-testid", "regression-input");
      input.style.cssText =
        "position:fixed;top:10px;left:10px;z-index:99999;padding:8px;border:2px solid red;background:yellow;font-size:14px";
      document.body.appendChild(input);
    });

    const input = page.locator('[data-testid="regression-input"]');
    await expect(input).toBeVisible();
    await input.click();
    await expect(input).toBeFocused();

    // Basic typing
    await input.type("regression test works");
    await expect(input).toHaveValue("regression test works");

    // Backspace
    await page.keyboard.press("Backspace");
    await expect(input).toHaveValue("regression test work");

    // Special characters
    await input.clear();
    await input.type("!@#$%^&*()_+-=[]{}|;:,.<>?");
    await expect(input).toHaveValue("!@#$%^&*()_+-=[]{}|;:,.<>?");
  });

  test("rapid typing is not lost to event interference", async ({ page }) => {
    await page.goto("/login");

    await page.evaluate(() => {
      const input = document.createElement("input");
      input.setAttribute("data-testid", "rapid-input");
      input.style.cssText =
        "position:fixed;top:50px;left:10px;z-index:99999;padding:8px;border:2px solid blue;background:lightblue";
      document.body.appendChild(input);
    });

    const input = page.locator('[data-testid="rapid-input"]');
    await input.click();

    const rapidText = "thequickbrownfoxjumpsoverthelazydog";
    await input.type(rapidText, { delay: 10 });
    await expect(input).toHaveValue(rapidText);
  });

  test("input events fire correctly (keydown, beforeinput, input)", async ({ page }) => {
    await page.goto("/login");

    await page.evaluate(() => {
      window._eventCounts = { beforeinput: 0, input: 0, keydown: 0 };

      const input = document.createElement("input");
      input.setAttribute("data-testid", "event-input");
      input.style.cssText =
        "position:fixed;top:90px;left:10px;z-index:99999;padding:8px;border:2px solid green;background:lightgreen";
      document.body.appendChild(input);

      input.addEventListener("beforeinput", () => window._eventCounts.beforeinput++);
      input.addEventListener("input", () => window._eventCounts.input++);
      input.addEventListener("keydown", () => window._eventCounts.keydown++);
    });

    const input = page.locator('[data-testid="event-input"]');
    await input.click();
    await input.type("event test");

    const counts = await page.evaluate(() => window._eventCounts);
    expect(counts.keydown).toBeGreaterThan(0);
    expect(counts.beforeinput).toBeGreaterThan(0);
    expect(counts.input).toBeGreaterThan(0);
    await expect(input).toHaveValue("event test");
  });
});
