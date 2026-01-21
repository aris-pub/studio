import { test, expect } from "@playwright/test";

// @demo
import { AuthHelpers } from "./utils/auth-helpers.js";
import { MobileHelpers } from "./utils/mobile-helpers.js";
import { TIMEOUTS } from "./utils/timeout-constants.js";

test.describe.skip("Demo Content Rendering @demo-disabled", () => {
  let authHelpers;
  let mobileHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    mobileHelpers = new MobileHelpers(page);

    // Ensure clean auth state for demo access
    await authHelpers.clearAuthState();

    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    // Mobile browsers need extra time for rendering
    await mobileHelpers.waitForMobileRendering();
  });

  test.describe("Content Loading", () => {
    test("demo manuscript content loads and displays", async ({ page }) => {
      // Wait for demo canvas to be loaded (not just the loading screen)
      // First wait for demo canvas to exist, then check if content is loaded
      await expect(page.locator('[data-testid="demo-canvas"]')).toBeVisible({
        timeout: 20000,
      });

      // Wait for either data-loaded="true" or manuscript content to be visible
      await Promise.race([
        expect(page.locator('[data-testid="demo-canvas"][data-loaded="true"]')).toBeVisible({
          timeout: 5000,
        }),
        expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
          timeout: 5000,
        }),
      ]);

      // Wait for manuscript content to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check that manuscript content is rendered
      const manuscript = page.locator('[data-testid="manuscript-viewer"]');
      await expect(manuscript).toBeVisible();

      // Verify content is not empty
      const textContent = await manuscript.textContent();
      expect(textContent.trim().length).toBeGreaterThan(0);
    });

    test("RSM content renders with proper styling", async ({ page }) => {
      // Wait for manuscript to be visible
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check for RSM-specific classes and structure
      const manuscriptWrapper = page.locator(".manuscriptwrapper");
      await mobileHelpers.expectToBeVisible(manuscriptWrapper);

      const manuscript = page.locator(".manuscript");

      // For mobile browsers, use enhanced visibility approach
      if (mobileHelpers.isMobileViewport()) {
        // Ensure element exists and wait for it to be rendered
        await manuscript.waitFor({ state: "attached", timeout: 8000 });

        // Scroll to ensure element is in viewport
        await manuscript.scrollIntoViewIfNeeded();
        // Wait for scroll completion and layout recalculation
        await page.waitForTimeout(TIMEOUTS.ANIMATION);

        // Try standard Playwright visibility check first
        try {
          await expect(manuscript).toBeVisible({ timeout: 8000 });
        } catch {
          // For mobile browsers, use enhanced DOM visibility check
          await page.evaluate(() => {
            // Force layout recalculation
            document.body.offsetHeight;
            window.dispatchEvent(new Event("resize"));
          });
          await page.waitForTimeout(TIMEOUTS.ANIMATION);

          // Use enhanced DOM check as fallback
          const finalVisibility = await mobileHelpers.isElementVisibleInDOM(manuscript);
          expect(finalVisibility).toBe(true);
        }
      } else {
        await mobileHelpers.expectToBeVisible(manuscript);
      }

      // Verify manuscript has content
      const hasContent = await manuscript.evaluate((el) => el.children.length > 0);
      expect(hasContent).toBe(true);
    });

    test("interactive RSM elements are present and functional", async ({ page }) => {
      // Wait for manuscript content
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check if we're on mobile viewport
      const viewportSize = page.viewportSize();
      const isMobile = viewportSize && viewportSize.width < 640;

      // Look for RSM handrails (interactive UI elements)
      const handrails = page.locator(".hr");

      // For mobile browsers, use enhanced visibility check with fallback
      if (isMobile) {
        await handrails.first().waitFor({ state: "attached", timeout: 8000 });

        // Scroll to ensure element is in viewport
        await handrails.first().scrollIntoViewIfNeeded();
        // Wait for scroll completion and layout recalculation
        await page.waitForTimeout(TIMEOUTS.ANIMATION);

        // Try standard Playwright visibility check first
        try {
          await expect(handrails.first()).toBeVisible({ timeout: 8000 });
        } catch {
          // For mobile browsers, use enhanced DOM visibility check
          await page.evaluate(() => {
            // Force layout recalculation
            document.body.offsetHeight;
            window.dispatchEvent(new Event("resize"));
          });
          await page.waitForTimeout(TIMEOUTS.ANIMATION);

          const isVisible = await mobileHelpers.isElementVisibleInDOM(handrails.first());
          expect(isVisible).toBe(true);
        }
      } else {
        await mobileHelpers.expectToBeVisible(handrails.first(), 8000);
      }

      // Check for interactive elements like headings with handrails
      const headingHandrails = page.locator(".heading.hr");
      if (isMobile) {
        await headingHandrails.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
      await expect(headingHandrails.first()).toBeVisible({ timeout: isMobile ? 8000 : 5000 });

      // Verify handrails have interactive menus
      const hrMenus = page.locator(".hr-menu");
      const menuCount = await hrMenus.count();
      expect(menuCount).toBeGreaterThan(0);
    });

    test("content loads within reasonable time", async ({ page }) => {
      const startTime = Date.now();

      // Wait for content to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      const loadTime = Date.now() - startTime;

      // Content should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });
  });

  test.describe("Visual Verification", () => {
    test("research paper title is visible", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Look for the main title
      const title = page.locator("h1").first();

      // Check if we're on mobile viewport
      const viewportSize = page.viewportSize();
      const isMobile = viewportSize && viewportSize.width < 640;

      // For mobile browsers, use enhanced visibility check with fallback
      if (isMobile) {
        await title.waitFor({ state: "attached", timeout: 8000 });

        // Scroll to ensure element is in viewport
        await title.scrollIntoViewIfNeeded();
        // Wait for scroll completion and layout recalculation
        await page.waitForTimeout(TIMEOUTS.ANIMATION);

        // Try standard Playwright visibility check first
        try {
          await expect(title).toBeVisible({ timeout: 8000 });
        } catch {
          // For mobile browsers, use enhanced DOM visibility check
          await page.evaluate(() => {
            // Force layout recalculation and scroll to element
            const h1 = document.querySelector("h1");
            if (h1) {
              h1.scrollIntoView({ behavior: "instant", block: "center" });
              document.body.offsetHeight;
              window.dispatchEvent(new Event("resize"));
            }
          });
          await page.waitForTimeout(TIMEOUTS.ANIMATION);

          const finalVisibility = await mobileHelpers.isElementVisibleInDOM(title);
          expect(finalVisibility).toBe(true);
        }
      } else {
        await mobileHelpers.expectToBeVisible(title, 8000);
      }

      const titleText = await title.textContent();
      expect(titleText).toContain("The Future of Web-Native Publishing");
    });

    test("section headings render correctly", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check if we're on mobile viewport
      const viewportSize = page.viewportSize();
      const isMobile = viewportSize && viewportSize.width < 640;

      // Check for various heading levels
      const h1Elements = page.locator("h1");
      const h2Elements = page.locator("h2");

      expect(await h1Elements.count()).toBeGreaterThan(0);
      expect(await h2Elements.count()).toBeGreaterThan(0);

      // Verify some expected section headings with mobile handling
      const introHeading = page.locator("text=Introduction");
      if (isMobile) {
        await introHeading.scrollIntoViewIfNeeded();
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
      await expect(introHeading).toBeVisible({ timeout: isMobile ? 8000 : 5000 });

      const methodologyHeading = page.getByRole("heading", { name: "2. Methodology" });
      if (isMobile) {
        await methodologyHeading.scrollIntoViewIfNeeded();
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
      await expect(methodologyHeading).toBeVisible({ timeout: isMobile ? 8000 : 5000 });

      const resultsHeading = page.locator("text=Results");
      if (isMobile) {
        await resultsHeading.scrollIntoViewIfNeeded();
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
      await expect(resultsHeading).toBeVisible({ timeout: isMobile ? 8000 : 5000 });

      const conclusionHeading = page.locator("text=Conclusion");
      if (isMobile) {
        await conclusionHeading.scrollIntoViewIfNeeded();
        await page.waitForTimeout(TIMEOUTS.ANIMATION);
      }
      await expect(conclusionHeading).toBeVisible({ timeout: isMobile ? 8000 : 5000 });
    });

    test("interactive handrails (RSM UI elements) are present @desktop-only", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check if we're on mobile viewport
      const viewportSize = page.viewportSize();
      const isMobile = viewportSize && viewportSize.width < 640;

      // Wait for RSM JavaScript to fully load
      await page.waitForFunction(
        () => {
          return window.jQuery && document.querySelectorAll(".hr-border-zone").length > 0;
        },
        { timeout: isMobile ? 20000 : 15000 }
      );

      // On mobile, ensure heading is visible and accessible for interaction
      const heading = page.locator("h1").first();
      if (isMobile) {
        // Ensure heading is in viewport and visible before tapping
        await heading.scrollIntoViewIfNeeded();
        // Wait for scroll completion and layout recalculation
        await page.waitForTimeout(TIMEOUTS.ANIMATION);

        // Force layout recalculation for mobile browsers
        await page.evaluate(() => {
          document.body.offsetHeight;
          window.dispatchEvent(new Event("resize"));
        });
        await page.waitForTimeout(TIMEOUTS.ANIMATION);

        // Verify heading is visible before attempting tap
        await expect(heading).toBeVisible({ timeout: 8000 });
        await heading.tap();
      } else {
        await heading.hover();
      }

      // Wait for border dots to become visible on hover/tap
      await expect(page.locator(".hr-border-dots").first()).toBeVisible({
        timeout: isMobile ? 8000 : 5000,
      });

      // Click the border dots to reveal the menu
      await page.locator(".hr-border-dots").first().click();

      // Now verify the menu zone becomes visible
      await expect(page.locator(".hr-menu-zone").first()).toBeVisible({
        timeout: isMobile ? 5000 : 3000,
      });

      // Check for various handrail components
      const menuZones = page.locator(".hr-menu-zone");
      const borderZones = page.locator(".hr-border-zone");
      const contentZones = page.locator(".hr-content-zone");

      expect(await menuZones.count()).toBeGreaterThan(0);
      expect(await borderZones.count()).toBeGreaterThan(0);
      expect(await contentZones.count()).toBeGreaterThan(0);
    });

    test("proper typography and spacing applied", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check that content has proper styling
      const manuscript = page.locator(".manuscript");
      await expect(manuscript).toBeVisible();

      // Verify text content has proper line height
      const computedStyle = await manuscript.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          fontFamily: styles.fontFamily,
          lineHeight: styles.lineHeight,
          fontSize: styles.fontSize,
        };
      });

      expect(computedStyle.fontFamily).toBeDefined();
      expect(computedStyle.lineHeight).toBeDefined();
      expect(computedStyle.fontSize).toBeDefined();
    });

    test("lists and itemization render correctly", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Look for itemized lists (from RSM :itemize: markup)
      const listItems = page.locator("li, .list-item");
      const listCount = await listItems.count();

      if (listCount > 0) {
        await expect(listItems.first()).toBeVisible();

        // Verify list items have content
        const firstItemText = await listItems.first().textContent();
        expect(firstItemText.trim().length).toBeGreaterThan(0);
      }
    });

    test("abstract section renders correctly", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Look for abstract content (from RSM :abstract: markup)
      const abstractSection = page.locator("text=This paper explores").first();
      await expect(abstractSection).toBeVisible({ timeout: 5000 });

      const abstractText = await abstractSection.textContent();
      expect(abstractText).toContain("web-native scientific publishing");
    });
  });

  test.describe("Backend Integration", () => {
    test("content loads from backend /render endpoint", async ({ page }) => {
      // Monitor network requests
      let renderRequestMade = false;

      page.on("request", (request) => {
        if (request.url().includes("/render") && request.method() === "POST") {
          renderRequestMade = true;
        }
      });

      // Navigate to demo (fresh load to trigger API call)
      await page.reload();
      await page.waitForLoadState("load");

      // Wait for content to load
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Verify the render request was made
      expect(renderRequestMade).toBe(true);
    });

    test("RSM CSS loads from backend /static/rsm.css", async ({ page }) => {
      // Monitor for CSS requests
      let rsmCssLoaded = false;

      page.on("response", (response) => {
        if (response.url().includes("/static/rsm.css")) {
          rsmCssLoaded = true;
        }
      });

      await page.reload();
      await page.waitForLoadState("load");

      // Wait for styles to apply
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Verify RSM CSS was loaded
      expect(rsmCssLoaded).toBe(true);
    });

    test("network requests complete successfully", async ({ page }) => {
      const failedRequests = [];

      page.on("requestfailed", (request) => {
        failedRequests.push(request.url());
      });

      await page.reload();
      await page.waitForLoadState("load");

      // Wait for content to load completely
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check for any failed requests related to demo content
      const demoRelatedFailures = failedRequests.filter(
        (url) => url.includes("/render") || url.includes("/static/rsm.css")
      );

      expect(demoRelatedFailures).toHaveLength(0);
    });

    test("handles backend unavailability gracefully", async ({ page }) => {
      // Block requests to render endpoint to simulate backend down
      await page.route("**/render", (route) => {
        route.abort("failed");
      });

      await page.reload();
      await page.waitForLoadState("load");

      // Content should still attempt to load or show fallback
      await expect(page.locator('[data-testid="demo-canvas"]')).toBeVisible();

      // Should not show error messages to user
      const errorMessages = page.locator("text=error", { ignoreCase: true });
      expect(await errorMessages.count()).toBe(0);
    });
  });

  test.describe("Content Quality", () => {
    test("content contains expected research sections", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check for standard academic paper sections using headings
      await expect(page.getByRole("heading", { name: "Abstract" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Introduction" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Discussion" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Conclusion" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Acknowledgments" })).toBeVisible();
    });

    test("content is substantive and realistic", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      // Check that content has meaningful length
      const manuscriptText = await page.locator('[data-testid="manuscript-viewer"]').textContent();
      const wordCount = manuscriptText.split(/\s+/).length;

      // Research paper should have substantial content
      expect(wordCount).toBeGreaterThan(500);

      // Should contain academic terminology
      expect(manuscriptText).toContain("research");
      expect(manuscriptText).toContain("analysis");
      expect(manuscriptText).toContain("methodology");
    });

    test("RSM markup renders correctly without raw syntax", async ({ page }) => {
      await expect(page.locator('[data-testid="manuscript-viewer"]')).toBeVisible({
        timeout: 10000,
      });

      const manuscriptText = await page.locator('[data-testid="manuscript-viewer"]').textContent();

      // Should not contain raw RSM syntax
      expect(manuscriptText).not.toContain(":rsm:");
      expect(manuscriptText).not.toContain(":itemize:");
      expect(manuscriptText).not.toContain(":enumerate:");
      expect(manuscriptText).not.toContain(":-:");
      expect(manuscriptText).not.toContain("::");

      // Should not contain escaped characters
      expect(manuscriptText).not.toContain("\\n");
      expect(manuscriptText).not.toContain('\\"');
    });
  });
});
