#!/usr/bin/env node

/**
 * Debug Y.js collaboration - test minimal HTML first, then Vue component
 */

import { chromium } from "playwright";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const FRONTEND_URL = "http://localhost:5173";
const MINIMAL_TEST_URL = "http://localhost:5173/test-yjs-minimal.html";

async function testMinimalHTML() {
  console.log("\n🧪 Testing Minimal Y.js HTML...\n");

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Collect console logs
  const logs = [];
  page.on("console", (msg) => logs.push(`[CONSOLE] ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`[ERROR] ${err.message}`));

  try {
    await page.goto(MINIMAL_TEST_URL, { waitUntil: "networkidle" });

    // Wait for both editors to be created
    await page.waitForTimeout(5000);

    // Type in first editor
    console.log("Typing in Editor 1...");
    await page.click("#editor1 .cm-content");
    await page.keyboard.type("TEST");

    // Wait for sync
    await page.waitForTimeout(2000);

    // Check if text appears in second editor
    const editor2Text = await page.evaluate(() => {
      const editor2 = document.querySelector("#editor2 .cm-content");
      return editor2 ? editor2.textContent : null;
    });

    console.log(`Editor 2 content: "${editor2Text}"`);

    if (editor2Text && editor2Text.includes("TEST")) {
      console.log("\n✅ Minimal HTML test PASSED - sync working!");
      console.log("\nConsole logs:");
      logs.forEach((log) => console.log(log));
      await browser.close();
      return true;
    } else {
      console.log("\n❌ Minimal HTML test FAILED - no sync");
      console.log("\nConsole logs:");
      logs.forEach((log) => console.log(log));
      await browser.close();
      return false;
    }
  } catch (error) {
    console.error("\n❌ Test error:", error.message);
    console.log("\nConsole logs:");
    logs.forEach((log) => console.log(log));
    await browser.close();
    return false;
  }
}

async function testVueComponent() {
  console.log("\n🧪 Testing Vue Component Y.js Integration...\n");

  const browser = await chromium.launch({ headless: false });

  try {
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Collect errors
    const errors1 = [];
    const errors2 = [];

    page1.on("pageerror", (err) => errors1.push(err.message));
    page2.on("pageerror", (err) => errors2.push(err.message));

    page1.on("console", (msg) => {
      if (msg.type() === "error") errors1.push(msg.text());
    });
    page2.on("console", (msg) => {
      if (msg.type() === "error") errors2.push(msg.text());
    });

    // Login both users
    console.log("User 1: Logging in...");
    await page1.goto(FRONTEND_URL);
    await page1.fill('[data-testid="email-input"]', "foo@bar.com");
    await page1.fill('[data-testid="password-input"]', "admin");
    await page1.click('[data-testid="login-button"]');
    await page1.waitForURL("**/", { timeout: 10000 });
    console.log("User 1: Logged in");

    console.log("User 2: Logging in...");
    await page2.goto(FRONTEND_URL);
    await page2.fill('[data-testid="email-input"]', "foo@bar.com");
    await page2.fill('[data-testid="password-input"]', "admin");
    await page2.click('[data-testid="login-button"]');
    await page2.waitForURL("**/", { timeout: 10000 });
    console.log("User 2: Logged in");

    // Wait for editors to load
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    // Check for CodeMirror editors
    const hasEditor1 = (await page1.locator(".cm-editor").count()) > 0;
    const hasEditor2 = (await page2.locator(".cm-editor").count()) > 0;

    console.log(`User 1 has editor: ${hasEditor1}`);
    console.log(`User 2 has editor: ${hasEditor2}`);

    if (!hasEditor1 || !hasEditor2) {
      console.log("\n❌ Editors not loaded");
      await browser.close();
      return false;
    }

    // Type in first editor
    console.log("\nUser 1: Typing...");
    await page1.click(".cm-content");
    await page1.keyboard.type("SYNC_TEST");

    // Wait for sync
    await page1.waitForTimeout(3000);

    // Check for errors
    if (errors1.length > 0) {
      console.log("\n❌ User 1 errors:");
      errors1.forEach((err) => console.log(`  - ${err}`));
    }

    if (errors2.length > 0) {
      console.log("\n❌ User 2 errors:");
      errors2.forEach((err) => console.log(`  - ${err}`));
    }

    // Get content from both editors
    const content1 = await page1.evaluate(() => {
      return window.__cmView ? window.__cmView.state.doc.toString() : null;
    });

    const content2 = await page2.evaluate(() => {
      return window.__cmView ? window.__cmView.state.doc.toString() : null;
    });

    console.log(`\nUser 1 content: "${content1?.slice(-50)}"`);
    console.log(`User 2 content: "${content2?.slice(-50)}"`);

    if (content2 && content2.includes("SYNC_TEST")) {
      console.log("\n✅ Vue component test PASSED - sync working!");
      await browser.close();
      return true;
    } else {
      console.log("\n❌ Vue component test FAILED - no sync");
      await browser.close();
      return false;
    }
  } catch (error) {
    console.error("\n❌ Test error:", error.message);
    await browser.close();
    return false;
  }
}

async function main() {
  console.log("🚀 Y.js Collaboration Debug Test\n");

  // Test 1: Minimal HTML
  const minimalPassed = await testMinimalHTML();

  if (!minimalPassed) {
    console.log("\n⚠️  Minimal HTML test failed - basic Y.js setup has issues");
    console.log("Fix the minimal example first before testing Vue component");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));

  // Test 2: Vue component
  const vuePassed = await testVueComponent();

  if (!vuePassed) {
    console.log("\n⚠️  Vue component test failed");
    console.log("The minimal HTML works but Vue integration is broken");
    process.exit(1);
  }

  console.log("\n✅ All tests passed!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
