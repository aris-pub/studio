/**
 * Puppeteer Bug Reproduction Template
 *
 * Use this template to replicate user interaction bugs in the RSM Studio frontend.
 * Always run in headless mode as specified in CLAUDE.md.
 *
 * Usage:
 * 1. Copy this template
 * 2. Modify the steps in replicateBug() to match the reported bug
 * 3. Run with: node debug-bug-template.js
 * 4. Check console output and screenshots for debugging info
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function replicateBug() {
  const browser = await puppeteer.launch({
    headless: true, // Always headless as per CLAUDE.md
    defaultViewport: { width: 1280, height: 720 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    // Enable console logging from the page
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));

    // Navigate to the app (adjust URL if needed)
    console.log("Navigating to app...");
    await page.goto(`http://localhost:${process.env.VITE_PORT || process.env.FRONTEND_PORT}`, {
      waitUntil: "networkidle2",
      timeout: 10000,
    });

    // Take initial screenshot
    await page.screenshot({ path: "debug-step-1-initial.png" });
    console.log("Initial screenshot saved");

    // ============================================
    // CUSTOMIZE THIS SECTION FOR EACH BUG REPORT
    // ============================================

    // Example: Login flow
    console.log("Starting bug replication steps...");

    // Step 1: Fill login form
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 5000 });
    await page.type('[data-testid="email-input"]', "test@example.com");
    await page.type('[data-testid="password-input"]', "testpassword");
    await page.screenshot({ path: "debug-step-2-login-filled.png" });

    // Step 2: Click login button
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(2000); // Wait for response
    await page.screenshot({ path: "debug-step-3-after-login.png" });

    // Step 3: Navigate to specific area where bug occurs
    // await page.click('[data-testid="files-container"]');
    // await page.waitForTimeout(1000);

    // Step 4: Perform the specific action that triggers the bug
    // await page.click('[data-testid="file-menu"]');
    // await page.waitForSelector('.context-menu', { visible: true });

    // Step 5: Take screenshot of bug state
    await page.screenshot({ path: "debug-step-final-bug-state.png" });

    // ============================================
    // END CUSTOMIZATION SECTION
    // ============================================

    console.log("Bug replication completed");
    console.log("Check debug-step-*.png files for visual evidence");

    // Extract any error messages or relevant DOM state
    const errorElements = await page.$$('[data-testid*="error"]');
    if (errorElements.length > 0) {
      console.log("Found error elements:", errorElements.length);
      for (let i = 0; i < errorElements.length; i++) {
        const text = await errorElements[i].textContent();
        console.log(`Error ${i + 1}:`, text);
      }
    }
  } catch (error) {
    console.error("Error during bug replication:", error.message);

    // Take screenshot of error state
    await page.screenshot({ path: "debug-error-state.png" });

    // Get current URL and page title for debugging
    const url = page.url();
    const title = await page.title();
    console.log("Current URL:", url);
    console.log("Page title:", title);
  } finally {
    await browser.close();
  }
}

// Helper functions for common actions
async function loginAsTestUser(page, email = "test@example.com", password = "testpassword") {
  await page.waitForSelector('[data-testid="email-input"]');
  await page.type('[data-testid="email-input"]', email);
  await page.type('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(2000);
}

async function navigateToWorkspace(page, fileId) {
  await page.goto(`http://localhost:${process.env.VITE_PORT || process.env.FRONTEND_PORT}/file/${fileId}`, {
    waitUntil: "networkidle2",
  });
}

async function waitForComponentToLoad(page, testId, timeout = 5000) {
  await page.waitForSelector(`[data-testid="${testId}"]`, {
    visible: true,
    timeout,
  });
}

// Run the bug replication
if (require.main === module) {
  replicateBug().catch(console.error);
}

module.exports = {
  replicateBug,
  loginAsTestUser,
  navigateToWorkspace,
  waitForComponentToLoad,
};
