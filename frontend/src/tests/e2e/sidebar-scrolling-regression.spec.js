/**
 * Regression test for sidebar scrolling issue
 *
 * Issue: In wide but short viewports, sidebar couldn't scroll enough to show
 * user avatar and focus mode button at the bottom.
 *
 * Fix: Removed conflicting height CSS declarations and increased bottom padding
 * to ensure proper internal scrolling behavior.
 */

import { test, expect } from "./fixtures.js";

// @core

test.describe("Sidebar Scrolling Regression @core @desktop-only", () => {
  test("sidebar scrolls properly in short viewport to show user menu", async ({ page }) => {
    // Set viewport to wide but short (the problematic case)
    await page.setViewportSize({ width: 1400, height: 450 });

    // Navigate to demo workspace
    await page.goto("/demo");

    // Wait for sidebar to load
    await expect(page.locator('[data-testid="workspace-sidebar"]')).toBeVisible();

    // Skip this test for mobile viewports since it tests desktop sidebar behavior
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 640) {
      test.skip();
      return;
    }

    // Get sidebar menu element (desktop version)
    const sidebarMenu = page.locator(".sb-menu:not(.mobile)");
    await expect(sidebarMenu).toBeVisible();

    // Verify sidebar can scroll (scrollHeight > clientHeight)
    const scrollability = await sidebarMenu.evaluate((menu) => ({
      canScroll: menu.scrollHeight > menu.clientHeight,
      scrollHeight: menu.scrollHeight,
      clientHeight: menu.clientHeight,
      initialScrollTop: menu.scrollTop,
    }));

    expect(scrollability.canScroll).toBe(true);
    expect(scrollability.scrollHeight).toBeGreaterThan(scrollability.clientHeight);
    expect(scrollability.initialScrollTop).toBe(0);

    // Check that user menu is initially not visible (cut off)
    const userMenu = page.locator(".user-menu-wrapper.desktop, .um-wrapper");
    await expect(userMenu).toBeVisible();

    const initialVisibility = await userMenu.evaluate((menu) => {
      const rect = menu.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        isVisible: rect.bottom <= window.innerHeight,
      };
    });

    expect(initialVisibility.isVisible).toBe(false);

    // Scroll sidebar to bottom
    await sidebarMenu.evaluate((menu) => {
      menu.scrollTop = menu.scrollHeight - menu.clientHeight;
    });

    // Verify user menu is now visible after scrolling
    const finalVisibility = await userMenu.evaluate((menu) => {
      const rect = menu.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        isVisible: rect.bottom <= window.innerHeight,
      };
    });

    expect(finalVisibility.isVisible).toBe(true);
    expect(finalVisibility.bottom).toBeLessThanOrEqual(finalVisibility.viewportHeight);

    // Verify scroll position changed
    const finalScrollTop = await sidebarMenu.evaluate((menu) => menu.scrollTop);
    expect(finalScrollTop).toBeGreaterThan(0);
  });

  test("sidebar maintains scrollability across different short viewport heights", async ({
    page,
  }) => {
    // Skip this test for mobile viewports since it tests desktop sidebar behavior
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 640) {
      test.skip();
      return;
    }

    // Test various short viewport heights to ensure robustness
    const testHeights = [300, 400, 500, 600];

    for (const height of testHeights) {
      await page.setViewportSize({ width: 1400, height });
      await page.goto("/demo");

      const sidebarMenu = page.locator(".sb-menu:not(.mobile)");
      await expect(sidebarMenu).toBeVisible();

      const scrollInfo = await sidebarMenu.evaluate((menu) => ({
        canScroll: menu.scrollHeight > menu.clientHeight,
        maxScrollTop: menu.scrollHeight - menu.clientHeight,
      }));

      // For heights <= 450px, scrolling should be needed
      if (height <= 450) {
        expect(scrollInfo.canScroll).toBe(true);
        expect(scrollInfo.maxScrollTop).toBeGreaterThan(0);
      }
    }
  });
});
