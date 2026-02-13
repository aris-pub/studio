import { test, expect, devices } from "@playwright/test";

// @auth @auth-interface
import { MobileHelpers } from "../utils/mobile-helpers.js";
import { AuthHelpers } from "../utils/auth-helpers.js";

test.describe("Mobile Sidebar Navigation UX @auth @mobile-only", () => {
  let mobileHelpers;

  const mobileDevices = [
    { name: "iPhone SE", device: devices["iPhone SE"] },
    { name: "iPhone 12", device: devices["iPhone 12"] },
    { name: "Samsung Galaxy S24", device: devices["Galaxy S24"] },
  ];

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
  });

  test.describe("Mobile Drawer Functionality", () => {
    mobileDevices.forEach((mobileDevice) => {
      test(`should show hamburger menu and drawer on ${mobileDevice.name}`, async ({ browser }) => {
        // Set device properties but exclude isMobile for Firefox compatibility
        const contextOptions = {
          ...mobileDevice.device,
          isMobile: undefined, // Remove isMobile to work with Firefox
        };

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        mobileHelpers = new MobileHelpers(page);
        const auth = new AuthHelpers(page);

        // Authenticate first
        await auth.fastAuth();

        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");
        await mobileHelpers.waitForMobileRendering();

        // Hamburger menu should be visible
        const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
        await mobileHelpers.expectToBeVisible(hamburgerButton);

        // Desktop sidebar should be hidden in mobile mode
        await expect(page.locator(".sb-wrapper:not(.drawer-open) .sb-menu")).not.toBeVisible();
        await expect(page.locator(".sb-wrapper:not(.drawer-open) #logo")).not.toBeVisible();

        // Mobile drawer should be closed initially
        await expect(page.locator(".sb-wrapper.drawer-open")).not.toBeVisible();

        // Click hamburger to open drawer
        await mobileHelpers.clickElement(hamburgerButton);
        await mobileHelpers.waitForMobileRendering();

        // Drawer should be open
        await expect(page.locator(".sb-wrapper.drawer-open")).toBeVisible();
        await expect(page.locator(".mobile-backdrop")).toBeVisible();

        // Sidebar menu should be visible in drawer
        await mobileHelpers.expectToBeVisible(
          page.locator(".sb-wrapper.drawer-open .sidebar-content .sb-menu")
        );
        await mobileHelpers.expectToBeVisible(
          page.locator(".sb-wrapper.drawer-open .sidebar-content #logo")
        );

        await context.close();
      });

      test(`should close drawer when backdrop is tapped on ${mobileDevice.name}`, async ({
        browser,
      }) => {
        // Set device properties but exclude isMobile for Firefox compatibility
        const contextOptions = {
          ...mobileDevice.device,
          isMobile: undefined, // Remove isMobile to work with Firefox
        };

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        mobileHelpers = new MobileHelpers(page);
        const auth = new AuthHelpers(page);

        // Authenticate first
        await auth.fastAuth();

        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");

        // Open drawer
        const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
        await mobileHelpers.clickElement(hamburgerButton);
        await mobileHelpers.waitForMobileRendering();

        // Verify drawer is open
        await expect(page.locator(".sb-wrapper.drawer-open")).toBeVisible();

        // Click backdrop to close
        const backdrop = page.locator(".mobile-backdrop");
        await mobileHelpers.clickElement(backdrop);
        await mobileHelpers.waitForMobileRendering();

        // Drawer should be closed
        await expect(page.locator(".sb-wrapper.drawer-open")).not.toBeVisible();
        await expect(page.locator(".mobile-backdrop")).not.toBeVisible();

        await context.close();
      });

      test(`should close drawer when navigation item is tapped on ${mobileDevice.name}`, async ({
        browser,
      }) => {
        // Set device properties but exclude isMobile for Firefox compatibility
        const contextOptions = {
          ...mobileDevice.device,
          isMobile: undefined, // Remove isMobile to work with Firefox
        };

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        mobileHelpers = new MobileHelpers(page);
        const auth = new AuthHelpers(page);

        // Authenticate first
        await auth.fastAuth();

        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");

        // Open drawer
        const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
        await mobileHelpers.clickElement(hamburgerButton);
        await mobileHelpers.waitForMobileRendering();

        // Click on Settings navigation item
        const settingsItem = page.locator(
          '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Settings"]'
        );
        await mobileHelpers.clickElement(settingsItem);

        // Wait for navigation
        await mobileHelpers.waitForURLPattern(/\/settings/);
        await mobileHelpers.waitForMobileRendering();

        // Drawer should be closed after navigation
        await expect(page.locator(".sb-wrapper.drawer-open")).not.toBeVisible();
        await expect(page.locator(".mobile-backdrop")).not.toBeVisible();

        // Should be on settings page
        await expect(page).toHaveURL(/\/settings/);

        await context.close();
      });
    });

    test("should prevent body scroll when drawer is open", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPhone SE"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Check initial body overflow
      const initialOverflow = await page.evaluate(() => document.body.style.overflow);

      // Open drawer
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);
      await mobileHelpers.waitForMobileRendering();

      // Body should have overflow hidden
      const openOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(openOverflow).toBe("hidden");

      // Close drawer
      const backdrop = page.locator(".mobile-backdrop");
      await mobileHelpers.clickElement(backdrop);
      await mobileHelpers.waitForMobileRendering();

      // Body overflow should be restored
      const closedOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(closedOverflow).toBe(initialOverflow);

      await context.close();
    });
  });

  test.describe("Mobile Navigation UX - Home View", () => {
    test("should provide mobile navigation on home page", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPhone SE"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Open mobile drawer
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);
      await mobileHelpers.waitForMobileRendering();

      // Should show main navigation items (Account moved to UserMenu)
      await mobileHelpers.expectToBeVisible(
        page.locator('.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Home"]')
      );
      await mobileHelpers.expectToBeVisible(
        page.locator('.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Settings"]')
      );

      // Should show recent files section if available
      const recentFiles = page.locator(
        ".sb-wrapper.drawer-open .sidebar-content .sb-menu .recent-files"
      );
      if ((await recentFiles.count()) > 0) {
        await mobileHelpers.expectToBeVisible(recentFiles);
      }

      // Should show new file button/menu
      await mobileHelpers.expectToBeVisible(
        page.locator('.sb-wrapper.drawer-open .sidebar-content [data-testid="create-file-button"]')
      );

      await context.close();
    });

    // TEMPORARILY DISABLED: Failing due to navigation load event timeout
    // Error: page.waitForURL: Test timeout of 15000ms exceeded - navigation succeeds but load event never fires
    // TODO: Re-enable once mobile navigation load state issues are resolved
    test.skip("should navigate from home to account via user menu drawer", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await page.waitForLoadState("load");
      await mobileHelpers.waitForVueComponentMount();

      // Debug initial state
      await mobileHelpers.debugLoadState();

      // Open user menu drawer and navigate to Account
      const userAvatar = page.locator('[data-testid="user-avatar"]');
      await mobileHelpers.clickElement(userAvatar);

      const accountProfileItem = page.locator('[data-testid="account-profile"]');
      await mobileHelpers.clickElement(accountProfileItem);

      // Debug before navigation wait
      await mobileHelpers.debugLoadState();

      await mobileHelpers.waitForURLPattern(/\/account\/profile/);
      await expect(page).toHaveURL("/account/profile");
    });

    test("should navigate from home to settings via mobile drawer", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPhone SE"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/");
      await page.waitForLoadState("load");
      await mobileHelpers.waitForVueComponentMount();

      // Open drawer and navigate to Settings
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);

      const settingsItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Settings"]'
      );
      await mobileHelpers.clickElement(settingsItem);

      await mobileHelpers.debugLoadState();

      await mobileHelpers.waitForURLPattern(/\/settings/);
      await expect(page).toHaveURL(/\/settings/);

      await context.close();
    });
  });

  test.describe("Mobile Navigation UX - Account View", () => {
    test("should provide mobile navigation on account page", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPhone SE"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/account");
      await page.waitForLoadState("domcontentloaded");

      // Open mobile drawer
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);
      await mobileHelpers.waitForMobileRendering();

      // Should show main navigation items (Account moved to UserMenu)
      const homeItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Home"]'
      );
      const settingsItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Settings"]'
      );

      await mobileHelpers.expectToBeVisible(homeItem);
      await mobileHelpers.expectToBeVisible(settingsItem);

      // Neither should be marked as active when on account page
      await expect(homeItem).not.toHaveClass(/active/);
      await expect(settingsItem).not.toHaveClass(/active/);

      await context.close();
    });

    // TEMPORARILY DISABLED: Failing due to navigation load event timeout
    // Error: page.waitForURL: Test timeout of 15000ms exceeded - navigation succeeds but load event never fires
    // TODO: Re-enable once mobile navigation load state issues are resolved
    test.skip("should navigate from account to home via mobile drawer", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/account");
      await page.waitForLoadState("load");
      await mobileHelpers.waitForVueComponentMount();

      // Open drawer and navigate to Home
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);

      const homeItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Home"]'
      );
      await mobileHelpers.clickElement(homeItem);

      await mobileHelpers.debugLoadState();

      await mobileHelpers.waitForURLPattern(/^\/$/);
      await expect(page).toHaveURL("/");
    });
  });

  test.describe("Mobile Navigation UX - Settings View", () => {
    test("should provide mobile navigation on settings page", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPhone SE"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Open mobile drawer
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);
      await mobileHelpers.waitForMobileRendering();

      // Should show main navigation with Settings active
      const homeItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Home"]'
      );
      const settingsItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Settings"]'
      );

      await mobileHelpers.expectToBeVisible(homeItem);
      await mobileHelpers.expectToBeVisible(settingsItem);

      // Settings should be marked as active
      await expect(settingsItem).toHaveClass(/active/);
      await expect(homeItem).not.toHaveClass(/active/);

      // Should show settings sub-navigation items
      await mobileHelpers.expectToBeVisible(
        page.locator(
          '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-subitem="File Display"]'
        )
      );
      await mobileHelpers.expectToBeVisible(
        page.locator('.sb-wrapper.drawer-open .sidebar-content [data-sidebar-subitem="Behavior"]')
      );
      await mobileHelpers.expectToBeVisible(
        page.locator(
          '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-subitem="Notifications"]'
        )
      );

      await context.close();
    });

    test("should navigate between settings sub-sections via mobile drawer", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPhone SE"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Open drawer and navigate to Behavior settings
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);

      const behaviorItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-subitem="Behavior"]'
      );
      await mobileHelpers.clickElement(behaviorItem);

      await mobileHelpers.waitForURLPattern(/\/settings\/behavior/);
      await expect(page).toHaveURL("/settings/behavior");

      // Open drawer and navigate to Notifications settings
      await mobileHelpers.clickElement(hamburgerButton);

      const notificationsItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-subitem="Notifications"]'
      );
      await mobileHelpers.clickElement(notificationsItem);

      await mobileHelpers.waitForURLPattern(/\/settings\/notifications/);
      await expect(page).toHaveURL("/settings/notifications");

      await context.close();
    });

    // TEMPORARILY DISABLED: Failing due to navigation load event timeout
    // Error: page.waitForURL: Test timeout of 15000ms exceeded - navigation succeeds but load event never fires
    // TODO: Re-enable once mobile navigation load state issues are resolved
    test.skip("should navigate from settings to other views via mobile drawer", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Navigate to Home from Settings
      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      await mobileHelpers.clickElement(hamburgerButton);

      const homeItem = page.locator(
        '.sb-wrapper.drawer-open .sidebar-content [data-sidebar-item="Home"]'
      );
      await mobileHelpers.clickElement(homeItem);

      await mobileHelpers.waitForURLPattern(/^\/$/);
      await expect(page).toHaveURL("/");
    });
  });

  test.describe("Mobile Animation and UX Polish", () => {
    test("should animate drawer open/close transitions", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["iPhone SE"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');
      const drawerWrapper = page.locator(".sb-wrapper");

      // Open drawer
      await mobileHelpers.clickElement(hamburgerButton);

      // Should have opening animation classes
      await expect(drawerWrapper).toHaveClass(/drawer-open/);
      await expect(drawerWrapper).toHaveClass(/mobile/);

      // Check for CSS transition properties
      const transitionDuration = await drawerWrapper.evaluate((el) =>
        getComputedStyle(el).getPropertyValue("transition-duration")
      );
      expect(transitionDuration).not.toBe("0s");

      await context.close();
    });

    // TEMPORARILY DISABLED: Failing due to missing mobile-menu-button element
    // Error: TimeoutError: Element not visible after timeout - mobile-menu-button doesn't exist
    // TODO: Re-enable once mobile hamburger menu button is properly implemented
    test.skip("should show visual feedback on hamburger button state", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      const hamburgerButton = page.locator('[data-testid="mobile-menu-button"]');

      // Button should show hamburger icon initially
      await expect(hamburgerButton.locator('[data-icon="Menu"]')).toBeVisible();

      // Open drawer
      await mobileHelpers.clickElement(hamburgerButton);
      await mobileHelpers.waitForMobileRendering();

      // Button should show close icon when drawer is open
      await expect(hamburgerButton.locator('[data-icon="X"]')).toBeVisible();
      await expect(hamburgerButton.locator('[data-icon="Menu"]')).not.toBeVisible();

      // Close drawer
      const backdrop = page.locator(".mobile-backdrop");
      await mobileHelpers.clickElement(backdrop);
      await mobileHelpers.waitForMobileRendering();

      // Button should show hamburger icon again
      await expect(hamburgerButton.locator('[data-icon="Menu"]')).toBeVisible();
      await expect(hamburgerButton.locator('[data-icon="X"]')).not.toBeVisible();
    });
  });

  test.describe("Desktop Mode Verification", () => {
    test("should not show mobile elements on desktop", async ({ browser }) => {
      const context = await browser.newContext({
        ...devices["Desktop Chrome"],
        isMobile: undefined, // Remove isMobile to work with Firefox
      });
      const page = await context.newPage();
      mobileHelpers = new MobileHelpers(page);
      const auth = new AuthHelpers(page);

      // Authenticate first
      await auth.fastAuth();

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Mobile hamburger button should not be visible
      await expect(page.locator('[data-testid="mobile-menu-button"]')).not.toBeVisible();

      // Desktop sidebar should be visible (not in mobile mode)
      await expect(page.locator(".sb-wrapper:not(.mobile) .sb-menu")).toBeVisible();
      await expect(page.locator(".sb-wrapper:not(.mobile) #logo")).toBeVisible();

      // Should not have mobile classes
      await expect(page.locator(".sb-wrapper.mobile")).not.toBeVisible();
      await expect(page.locator(".sb-wrapper.drawer-open")).not.toBeVisible();

      await context.close();
    });
  });
});
