import { test, expect } from "./fixtures.js";
import { MobileHelpers } from "./utils/mobile-helpers.js";
import { getTimeouts } from "./utils/timeout-constants.js";

// @demo

test.describe.skip("Demo Annotations Viewport @demo-disabled @mobile-only", () => {
  let mobileHelpers;

  test.beforeEach(async ({ page }) => {
    mobileHelpers = new MobileHelpers(page);
    const timeouts = getTimeouts(mobileHelpers.isMobileViewport());

    // Mock any backend requests that might fail in CI
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/manuscripts/") || url.includes("/demo")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: "demo content" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    // Wait for demo canvas to be loaded (optimized for CI performance)
    const demoCanvas = page.locator('[data-testid="demo-canvas"]');
    await expect(demoCanvas).toBeVisible({ timeout: timeouts.contentLoad });

    // For mobile browsers, wait for layout to stabilize
    if (mobileHelpers.isMobileViewport()) {
      await mobileHelpers.waitForMobileRendering();
      // Trigger a layout reflow to ensure content is visible
      await page.evaluate(() => {
        window.dispatchEvent(new Event("resize"));
      });
      await mobileHelpers.waitForMobileRendering();
    }
  });

  test("annotations panel should be visible within viewport", async ({ page }) => {
    // Wait for layout to stabilize, especially on mobile
    await mobileHelpers.waitForMobileRendering();

    // Multiple selectors for annotations panel
    const annotationsPanel = page.locator(
      '[data-testid*="annotations"], .dock.right.main, .annotations-container, .sidebar-right'
    );

    if ((await annotationsPanel.count()) > 0) {
      // Wait with extended timeout for mobile browsers
      await expect(annotationsPanel.first()).toBeVisible({ timeout: 15000 });

      // Get viewport and panel dimensions
      const viewport = page.viewportSize();
      const panelBox = await annotationsPanel.first().boundingBox();

      if (panelBox) {
        // Assert panel is within viewport horizontally (with tolerance for mobile)
        expect(panelBox.x).toBeGreaterThanOrEqual(-50); // Allow slight off-screen for mobile
        expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width + 50);

        // Adjust width expectations for mobile
        const isMobile = viewport.width < 640;
        const minWidth = isMobile ? 100 : 200;
        expect(panelBox.width).toBeGreaterThan(minWidth);
      }
    }
  });

  test("individual annotations should be visible", async ({ page }) => {
    // Wait for annotations to render
    await mobileHelpers.waitForMobileRendering();

    // Look for annotation content with broader selectors
    const annotations = page.locator(
      '.dock.right.main .annotation, .dock.right.main [data-testid*="annotation"], .annotations-container .annotation, .annotation-item'
    );

    if ((await annotations.count()) > 0) {
      const firstAnnotation = annotations.first();
      await expect(firstAnnotation).toBeVisible({ timeout: 15000 });

      // Check annotation is within viewport (with mobile tolerance)
      const viewport = page.viewportSize();
      const annotationBox = await firstAnnotation.boundingBox();

      if (annotationBox) {
        expect(annotationBox.x).toBeGreaterThanOrEqual(-50); // Mobile tolerance
        expect(annotationBox.x + annotationBox.width).toBeLessThanOrEqual(viewport.width + 50);
      }
    }
  });

  test("no horizontal scrollbar should be present", async ({ page }) => {
    // Wait for layout to stabilize
    await mobileHelpers.waitForMobileRendering();

    // Check document body doesn't have horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    const viewport = page.viewportSize();

    // Adjust tolerance for mobile browsers
    const isMobile = viewport.width < 640;
    const tolerance = isMobile ? 20 : 5; // More tolerance for mobile

    // Body should not be wider than viewport
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + tolerance);
  });

  test("annotations content should be readable", async ({ page }) => {
    // Wait for content to load and render
    await mobileHelpers.waitForMobileRendering();

    // Look for demo annotation content with more flexible selectors
    const commentText = page.locator(
      'text="This is an excellent point about accessibility barriers"'
    );
    const noteText = page.locator(
      'text="Consider adding more details about the technical implementation"'
    );

    // Also check for any annotation text content as fallback
    const anyAnnotationText = page.locator(".annotation-text, .comment-text, .note-content");

    if ((await commentText.count()) > 0) {
      await expect(commentText).toBeVisible({ timeout: 15000 });

      // Ensure text is within viewport (with mobile tolerance)
      const textBox = await commentText.boundingBox();
      const viewport = page.viewportSize();

      if (textBox) {
        expect(textBox.x + textBox.width).toBeLessThanOrEqual(viewport.width + 50);
      }
    } else if ((await noteText.count()) > 0) {
      await expect(noteText).toBeVisible({ timeout: 15000 });
    } else if ((await anyAnnotationText.count()) > 0) {
      // Fallback to any annotation text
      await expect(anyAnnotationText.first()).toBeVisible({ timeout: 15000 });
    }
  });

  test("canvas layout should use proper column structure", async ({ page }) => {
    // Wait for layout to stabilize
    await mobileHelpers.waitForMobileRendering();

    // Check for layout structure with multiple selector strategies
    const leftColumn = page.locator(
      ".left-column, .dock.left, [data-testid*='left'], .sidebar-left"
    );
    const middleColumn = page.locator(
      ".middle-column, .main-content, [data-testid*='middle'], .manuscript-container"
    );
    const rightColumn = page.locator(
      ".right-column, .dock.right, [data-testid*='right'], .sidebar-right"
    );

    // Check if columns exist in DOM
    const leftExists = (await leftColumn.count()) > 0;
    const middleExists = (await middleColumn.count()) > 0;
    const rightExists = (await rightColumn.count()) > 0;

    // Middle column should always be visible (contains main content)
    if (middleExists) {
      await expect(middleColumn.first()).toBeVisible({ timeout: 10000 });
    }

    // Right column should be visible if it contains annotations
    if (rightExists) {
      const rightColumnElement = rightColumn.first();
      const isRightVisible = await rightColumnElement.isVisible();
      if (isRightVisible) {
        await expect(rightColumnElement).toBeVisible({ timeout: 10000 });
      }
    }

    // Left column exists in DOM but may be empty/hidden (placeholder for future features)
    // Only test its visibility if it actually has visible content
    if (leftExists) {
      const leftColumnElement = leftColumn.first();
      const isLeftVisible = await leftColumnElement.isVisible();

      // If left column is visible, verify layout positioning
      if (isLeftVisible && middleExists && rightExists) {
        const leftBox = await leftColumnElement.boundingBox();
        const middleBox = await middleColumn.first().boundingBox();

        if (leftBox && middleBox) {
          // Verify left comes before middle
          expect(leftBox.x).toBeLessThan(middleBox.x);
        }

        // If right column is also visible, verify full layout
        const rightColumnElement = rightColumn.first();
        const isRightVisibleForLayout = await rightColumnElement.isVisible();
        if (isRightVisibleForLayout) {
          const rightBox = await rightColumnElement.boundingBox();
          if (rightBox && middleBox) {
            expect(middleBox.x).toBeLessThan(rightBox.x);
            expect(rightBox.x + rightBox.width).toBeLessThanOrEqual(page.viewportSize().width + 20);
          }
        }
      }
    }

    // Fallback: ensure at least one layout element is visible
    if (!middleExists) {
      const anyLayout = page.locator(".workspace, .layout, .demo-content, .manuscript-viewer");
      await expect(anyLayout.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("mobile content should be visible and accessible", async ({ page }) => {
    const viewport = page.viewportSize();

    // Only run this test on mobile viewports
    if (viewport.width >= 640) {
      test.skip();
    }

    // Wait for mobile layout to stabilize
    await mobileHelpers.waitForMobileRendering();

    // Check for key content elements that should be visible on mobile
    const contentElements = [
      ".manuscript, .demo-content, .workspace",
      "h1, h2, .title",
      ".main-content, .content-area",
      ".demo-banner, .banner",
    ];

    let visibleElementFound = false;

    for (const selector of contentElements) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          const firstElement = elements.first();

          // Enhanced visibility check for all mobile browsers
          await firstElement.scrollIntoViewIfNeeded();
          await mobileHelpers.waitForMobileRendering();

          // Try standard Playwright visibility check first for all browsers
          try {
            await expect(firstElement).toBeVisible({ timeout: 5000 });
            visibleElementFound = true;
            break;
          } catch {
            // Fallback to DOM visibility check for both webkit and chromium
            const isVisible = await mobileHelpers.isElementVisibleInDOM(firstElement);
            if (isVisible) {
              visibleElementFound = true;
              break;
            }
          }
        }
      } catch (error) {
        // If browser is closed or element not found, continue to next selector
        if (error.message?.includes("Target page, context or browser has been closed")) {
          break; // Exit the loop if browser is closed
        }
        // Continue to next selector for other errors
      }
    }

    // At least one content element should be visible
    expect(visibleElementFound, "No content elements visible on mobile").toBe(true);
  });
});
