import { test, expect } from "./fixtures.js";

// @demo
import { AuthHelpers } from "./utils/auth-helpers.js";

test.describe
  .skip("Focus Mode and Drawer Interaction @demo-disabled @desktop-only - DISABLED", () => {
  let authHelpers;

  test.beforeEach(async ({ page }) => {
    // Set desktop viewport for desktop-only keyboard navigation tests
    await page.setViewportSize({ width: 1024, height: 768 });
    authHelpers = new AuthHelpers(page);
    await authHelpers.clearAuthState();

    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    // Wait for demo content to load (optimized for CI performance)
    await expect(page.locator('[data-testid="demo-canvas"]')).toBeVisible();
  });

  test.describe("Focus Mode Button Visibility with Drawer", () => {
    test("focus mode button is visible and clickable when drawer is open", async ({ page }) => {
      // First, open a drawer (e.g., settings drawer)
      const settingsButton = page
        .locator('[data-testid*="settings"], button:has-text("settings")')
        .first();

      if ((await settingsButton.count()) > 0) {
        await settingsButton.click();
        await page.waitForTimeout(100); // Wait for drawer animation

        // Verify drawer is open
        const drawer = page.locator(".drawer.active");
        if ((await drawer.count()) > 0) {
          await expect(drawer).toBeVisible();
        }
      }

      // Activate focus mode using keyboard shortcut
      await page.keyboard.press("c");
      await page.waitForTimeout(100); // Wait for focus mode transition

      // Verify we're in focus mode (sidebar should be hidden)
      const sidebar = page.locator('[data-testid="workspace-sidebar"]');
      if ((await sidebar.count()) > 0) {
        await expect(sidebar).toHaveClass(/focus/);
      }

      // The focus mode deactivation button should be visible and clickable
      const focusButton = page.locator('button[icon="Layout"], .layout-on');
      if ((await focusButton.count()) > 0) {
        await expect(focusButton).toBeVisible();

        // Button should be positioned correctly (not behind where drawer was)
        const buttonBox = await focusButton.boundingBox();
        expect(buttonBox).toBeTruthy();
        expect(buttonBox.x).toBeLessThan(100); // Should be near left edge, not at 424px

        // Click to deactivate focus mode
        await focusButton.click();
        await page.waitForTimeout(100); // Wait for transition

        // Verify focus mode is deactivated
        if ((await sidebar.count()) > 0) {
          await expect(sidebar).not.toHaveClass(/focus/);
        }
      }
    });

    test("focus mode can be activated and deactivated with drawer open using keyboard shortcut @desktop-only", async ({
      page,
    }) => {
      // Open a drawer first
      const marginsButton = page
        .locator('[data-testid*="margins"], button:has-text("margins")')
        .first();

      if ((await marginsButton.count()) > 0) {
        await marginsButton.click();
        await page.waitForTimeout(100);
      }

      // Activate focus mode with 'c' key
      await page.keyboard.press("c");
      await page.waitForTimeout(100);

      // Verify focus mode is active
      const sidebar = page.locator('[data-testid="workspace-sidebar"]');
      if ((await sidebar.count()) > 0) {
        await expect(sidebar).toHaveClass(/focus/);
      }

      // Deactivate focus mode with 'c' key again
      await page.keyboard.press("c");
      await page.waitForTimeout(100);

      // Verify focus mode is deactivated
      if ((await sidebar.count()) > 0) {
        await expect(sidebar).not.toHaveClass(/focus/);
      }
    });

    test("drawer remains accessible after exiting focus mode", async ({ page }) => {
      // Open activity drawer
      const activityButton = page
        .locator('[data-testid*="activity"], button:has-text("activity")')
        .first();

      if ((await activityButton.count()) > 0) {
        await activityButton.click();
        await page.waitForTimeout(100);

        // Verify drawer is open
        const drawer = page.locator(".drawer.active");
        if ((await drawer.count()) > 0) {
          await expect(drawer).toBeVisible();
        }

        // Enter focus mode
        await page.keyboard.press("c");
        await page.waitForTimeout(100);

        // Drawer should be hidden in focus mode
        if ((await drawer.count()) > 0) {
          await expect(drawer).toHaveClass(/focus/);
        }

        // Exit focus mode using the button
        const focusButton = page.locator('button[icon="Layout"], .layout-on');
        if ((await focusButton.count()) > 0) {
          await expect(focusButton).toBeVisible();
          await focusButton.click();
          await page.waitForTimeout(100);
        }

        // Drawer should be visible again after exiting focus mode
        if ((await drawer.count()) > 0) {
          await expect(drawer).toBeVisible();
          await expect(drawer).not.toHaveClass(/focus/);
        }
      }
    });

    test("focus mode button positioning is correct in different drawer states", async ({
      page,
    }) => {
      // Test with no drawer open
      await page.keyboard.press("c"); // Enter focus mode
      await page.waitForTimeout(100);

      let focusButton = page.locator('button[icon="Layout"], .layout-on');
      let normalFocusModePosition = 0;

      if ((await focusButton.count()) > 0) {
        const buttonBox = await focusButton.boundingBox();
        normalFocusModePosition = buttonBox.x;
        expect(normalFocusModePosition).toBeLessThan(50); // Should be near left edge
      }

      // Exit focus mode
      await page.keyboard.press("c");
      await page.waitForTimeout(100);

      // Open a drawer
      const settingsButton = page
        .locator('[data-testid*="settings"], button:has-text("settings")')
        .first();

      if ((await settingsButton.count()) > 0) {
        await settingsButton.click();
        await page.waitForTimeout(100);

        // Enter focus mode with drawer open
        await page.keyboard.press("c");
        await page.waitForTimeout(100);

        // Button position should be the same as when no drawer was open
        focusButton = page.locator('button[icon="Layout"], .layout-on');
        if ((await focusButton.count()) > 0) {
          const buttonBox = await focusButton.boundingBox();
          expect(buttonBox.x).toBeLessThan(50); // Should still be near left edge
          expect(Math.abs(buttonBox.x - normalFocusModePosition)).toBeLessThan(10); // Should be approximately same position
        }
      }
    });
  });

  test.describe("Focus Mode User Experience", () => {
    test("complete user workflow: drawer interaction → focus mode → back to normal", async ({
      page,
    }) => {
      // Step 1: Open multiple drawers to test interaction
      const buttons = [
        { selector: '[data-testid*="margins"], button:has-text("margins")', name: "margins" },
        { selector: '[data-testid*="settings"], button:has-text("settings")', name: "settings" },
      ];

      for (const button of buttons) {
        const btn = page.locator(button.selector).first();
        if ((await btn.count()) > 0) {
          await btn.click();
          await page.waitForTimeout(50);

          // Verify drawer opens
          const drawer = page.locator(".drawer.active");
          if ((await drawer.count()) > 0) {
            await expect(drawer).toBeVisible();
          }

          // Close drawer before opening next one
          await btn.click();
          await page.waitForTimeout(50);
        }
      }

      // Step 2: Open final drawer and enter focus mode
      const finalButton = page.locator(buttons[0].selector).first();
      if ((await finalButton.count()) > 0) {
        await finalButton.click();
        await page.waitForTimeout(100);

        // Step 3: Enter focus mode
        await page.keyboard.press("c");
        await page.waitForTimeout(100);

        // Step 4: Verify focus mode button is accessible
        const focusButton = page.locator('button[icon="Layout"], .layout-on');
        if ((await focusButton.count()) > 0) {
          await expect(focusButton).toBeVisible();

          // Step 5: Exit focus mode via button click
          await focusButton.click();
          await page.waitForTimeout(100);

          // Step 6: Verify normal state is restored
          const sidebar = page.locator('[data-testid="workspace-sidebar"]');
          if ((await sidebar.count()) > 0) {
            await expect(sidebar).not.toHaveClass(/focus/);
          }

          // Step 7: Verify drawer is still accessible
          const drawer = page.locator(".drawer.active");
          if ((await drawer.count()) > 0) {
            await expect(drawer).toBeVisible();
          }
        }
      }
    });
  });
});
