import { expect } from "@playwright/test";
import { getTimeouts } from "./timeout-constants.js";

export class MobileHelpers {
  constructor(page) {
    this.page = page;
  }

  /**
   * Check if we're running on a mobile viewport
   */
  isMobileViewport() {
    const viewportSize = this.page.viewportSize();
    return viewportSize && viewportSize.width < 640;
  }

  /**
   * Check if we're running on webkit (Safari/Mobile Safari)
   * @deprecated Use isMobileViewport() instead for consistent mobile detection
   */
  isWebkit() {
    const browserName = this.page.context().browser()?.browserType()?.name();
    return browserName === "webkit";
  }

  /**
   * Check if we're running on Mobile Chrome (chromium with mobile viewport)
   * @deprecated Use isMobileViewport() instead for consistent mobile detection
   */
  isMobileChrome() {
    return this.isMobileViewport();
  }

  /**
   * Get mobile-optimized timeout values
   */
  getTimeouts() {
    return getTimeouts(this.isMobileViewport());
  }

  /**
   * Wait with mobile-specific timing
   */
  async waitForMobileRendering() {
    if (this.isMobileViewport()) {
      const timeouts = this.getTimeouts();
      await this.page.waitForTimeout(timeouts.animation);
    }
  }

  /**
   * Perform mobile-friendly interaction (tap vs hover)
   */
  async interactWithElement(locator) {
    if (this.isMobileViewport()) {
      await locator.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(100); // Brief delay for scroll completion
      await locator.tap();
    } else {
      await locator.hover();
    }
  }

  /**
   * Wait for element visibility with mobile and webkit-optimized checks
   */
  async expectToBeVisible(locator, customTimeout = null) {
    const timeouts = this.getTimeouts();
    const timeout = customTimeout || timeouts.elementRender;

    console.log(`[Element Visibility] Waiting for element to be visible (timeout: ${timeout}ms)`);

    // Scroll element into view for all browsers if needed
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
    } catch {
      // Continue if scroll fails
    }

    try {
      await expect(locator).toBeVisible({ timeout });
      console.log(`[Element Visibility] Element is now visible`);
    } catch (error) {
      console.error(`[Element Visibility] Element not visible after ${timeout}ms`);

      // Debug element state
      const elementInfo = await this.debugElementState(locator);
      console.error(`[Element Visibility] Element debug info:`, elementInfo);

      // Take screenshot for debugging
      try {
        await this.page.screenshot({ path: `debug/debug-element-visibility-${Date.now()}.png` });
      } catch (screenshotError) {
        console.error(`[Element Visibility] Failed to take screenshot: ${screenshotError.message}`);
      }

      throw error;
    }
  }

  /**
   * Debug element state for troubleshooting
   */
  async debugElementState(locator) {
    try {
      const count = await locator.count();
      if (count === 0) {
        return { exists: false, count: 0 };
      }

      const element = locator.first();
      const boundingBox = await element.boundingBox();
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled();

      const styles = await element.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          display: computed.display,
          visibility: computed.visibility,
          opacity: computed.opacity,
          zIndex: computed.zIndex,
          position: computed.position,
        };
      });

      return {
        exists: true,
        count,
        boundingBox,
        isVisible,
        isEnabled,
        styles,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Enhanced element click for mobile browsers
   */
  async clickElement(locator) {
    console.log(`[Mobile Click] Attempting to click element: ${locator}`);

    if (this.isMobileViewport()) {
      try {
        await locator.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(100); // Brief delay for scroll completion
      } catch (scrollError) {
        console.warn(`[Mobile Click] Scroll failed, proceeding with click: ${scrollError.message}`);
        // Continue with click even if scroll fails
      }
    }

    try {
      await locator.click();
      console.log(`[Mobile Click] Successfully clicked element`);
    } catch (error) {
      console.error(`[Mobile Click] Click failed: ${error.message}`);
      // If click is intercepted, try force click
      if (error.message.includes("intercepts pointer events")) {
        console.log(`[Mobile Click] Retrying with force click`);
        await locator.click({ force: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Force click element when normal click is blocked by overlays
   */
  async forceClickElement(locator) {
    if (this.isMobileViewport()) {
      try {
        await locator.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(100); // Brief delay for scroll completion
      } catch (scrollError) {
        console.warn(
          `[Mobile Force Click] Scroll failed, proceeding with force click: ${scrollError.message}`
        );
        // Continue with force click even if scroll fails
      }
    }
    await locator.click({ force: true });
  }

  /**
   * Wait for navigation with mobile-optimized timeout and debugging
   */
  async waitForURLPattern(pattern, customTimeout = null) {
    const timeouts = this.getTimeouts();
    const timeout = customTimeout || timeouts.navigation;

    console.log(`[Mobile Navigation] Waiting for URL pattern: ${pattern} (timeout: ${timeout}ms)`);

    try {
      await this.page.waitForURL(pattern, { timeout });
      console.log(`[Mobile Navigation] Successfully navigated to: ${this.page.url()}`);
    } catch (error) {
      console.error(`[Mobile Navigation] Failed to navigate to pattern: ${pattern}`);
      console.error(`[Mobile Navigation] Current URL: ${this.page.url()}`);
      console.error(`[Mobile Navigation] Error: ${error.message}`);

      // Take screenshot for debugging
      try {
        await this.page.screenshot({ path: `debug-navigation-timeout-${Date.now()}.png` });
      } catch (screenshotError) {
        console.error(`[Mobile Navigation] Failed to take screenshot: ${screenshotError.message}`);
      }

      throw error;
    }
  }

  /**
   * Webkit-specific visibility check using DOM evaluation
   */
  async isElementVisibleInDOM(locator) {
    try {
      return await locator.evaluate((element) => {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        // Enhanced visibility check for mobile browsers
        const isDisplayed = style.display !== "none";
        const hasSize = rect.width > 0 && rect.height > 0;
        const isNotHidden = style.visibility !== "hidden" && style.opacity !== "0";

        // Check if element is in viewport for mobile browsers
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight,
        };

        const isInViewport =
          rect.top < viewport.height &&
          rect.bottom > 0 &&
          rect.left < viewport.width &&
          rect.right > 0;

        // More comprehensive check for mobile browsers
        return (
          isDisplayed && hasSize && isNotHidden && (element.offsetParent !== null || isInViewport)
        );
      });
    } catch {
      return false;
    }
  }

  /**
   * Enhanced content loading wait for mobile
   */
  async waitForContentLoaded(selector) {
    const timeouts = this.getTimeouts();

    console.log(`[Content Loading] Waiting for content to load: ${selector}`);

    // Wait for network to settle but avoid networkidle as it's discouraged
    await this.page.waitForLoadState("load");
    await this.waitForMobileRendering();

    // Wait for element to be visible
    await this.expectToBeVisible(this.page.locator(selector));

    // On mobile, also verify the element is actually rendered
    if (this.isMobileViewport()) {
      await this.page.waitForFunction(
        (sel) => {
          const element = document.querySelector(sel);
          return (
            element && getComputedStyle(element).display !== "none" && element.offsetParent !== null
          );
        },
        selector,
        { timeout: timeouts.contentLoad }
      );
    }

    console.log(`[Content Loading] Successfully loaded content: ${selector}`);
  }

  /**
   * Debug load state and log intermediate checkpoints
   */
  async debugLoadState() {
    const url = this.page.url();
    console.log(`[Load Debug] Current URL: ${url}`);

    // Check document ready state
    const readyState = await this.page.evaluate(() => document.readyState);
    console.log(`[Load Debug] Document ready state: ${readyState}`);

    // Check for pending requests
    const pendingRequests = await this.page.evaluate(() => {
      // Check for common loading indicators
      const loadingElements = document.querySelectorAll("[data-loading], .loading, .spinner");
      const vueLoadingComponents = document.querySelectorAll("[data-v-loading]");

      return {
        loadingElements: loadingElements.length,
        vueComponents: vueLoadingComponents.length,
        documentReadyState: document.readyState,
        visibilityState: document.visibilityState,
      };
    });

    console.log(`[Load Debug] Page state:`, pendingRequests);

    // Check for Vue.js app mount state
    const vueAppState = await this.page.evaluate(() => {
      const app = document.querySelector("#app");
      return {
        appExists: !!app,
        hasVueInstance: !!(app && app.__vue__),
        classList: app ? Array.from(app.classList) : [],
        childrenCount: app ? app.children.length : 0,
      };
    });

    console.log(`[Load Debug] Vue app state:`, vueAppState);
  }

  /**
   * Wait for Vue.js component to be fully mounted
   */
  async waitForVueComponentMount() {
    console.log(`[Vue Mount] Waiting for Vue component to mount`);

    await this.page.waitForFunction(
      () => {
        const app = document.querySelector("#app");
        return app && app.children.length > 0;
      },
      { timeout: this.getTimeouts().contentLoad }
    );

    // Additional wait for mobile rendering
    if (this.isMobileViewport()) {
      await this.waitForMobileRendering();
    }

    console.log(`[Vue Mount] Vue component successfully mounted`);
  }
}
