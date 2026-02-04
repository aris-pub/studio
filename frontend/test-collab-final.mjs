#!/usr/bin/env node
/**
 * Final collaboration test - automated verification
 */

import { chromium } from "playwright";

const FRONTEND_URL = "http://localhost:5173";
const TEST_EMAIL = "foo@bar.com";
const TEST_PASSWORD = "admin";

async function main() {
  console.log("🧪 Testing Multi-Player Collaboration (Final)\n");

  const browser = await chromium.launch({ headless: false, slowMo: 500 });

  try {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const errors1 = [];
    const errors2 = [];

    page1.on("pageerror", (err) => {
      console.log(`[User 1 ERROR] ${err.message}`);
      errors1.push(err.message);
    });

    page2.on("pageerror", (err) => {
      console.log(`[User 2 ERROR] ${err.message}`);
      errors2.push(err.message);
    });

    // Login User 1
    console.log("[User 1] Logging in...");
    await page1.goto(FRONTEND_URL);
    await page1.fill('[data-testid="email-input"]', TEST_EMAIL);
    await page1.fill('[data-testid="password-input"]', TEST_PASSWORD);
    await page1.click('[data-testid="login-button"]');
    await page1.waitForURL("**/", { timeout: 15000 });
    console.log("[User 1] ✓ Logged in\n");

    // Login User 2
    console.log("[User 2] Logging in...");
    await page2.goto(FRONTEND_URL);
    await page2.fill('[data-testid="email-input"]', TEST_EMAIL);
    await page2.fill('[data-testid="password-input"]', TEST_PASSWORD);
    await page2.click('[data-testid="login-button"]');
    await page2.waitForURL("**/", { timeout: 15000 });
    console.log("[User 2] ✓ Logged in\n");

    // Wait for editors to load
    console.log("Waiting for editors to initialize...");
    await page1.waitForTimeout(5000);
    await page2.waitForTimeout(5000);

    // Check for editors
    const hasEditor1 = (await page1.locator(".cm-editor").count()) > 0;
    const hasEditor2 = (await page2.locator(".cm-editor").count()) > 0;

    if (!hasEditor1 || !hasEditor2) {
      console.log("❌ Editors not found");
      await browser.close();
      process.exit(1);
    }

    console.log("[User 1] ✓ Editor loaded");
    console.log("[User 2] ✓ Editor loaded\n");

    // Type in User 1's editor
    console.log('[User 1] Typing: "COLLABORATION_TEST_123"');
    await page1.click(".cm-content");
    await page1.keyboard.type("COLLABORATION_TEST_123");

    // Wait for sync
    console.log("Waiting for sync (5 seconds)...\n");
    await page1.waitForTimeout(5000);

    // Check errors
    if (errors1.filter((e) => e.includes("update are not allowed")).length > 0) {
      console.log('❌ User 1 has "update in progress" errors');
      await browser.close();
      process.exit(1);
    }

    if (errors2.filter((e) => e.includes("update are not allowed")).length > 0) {
      console.log('❌ User 2 has "update in progress" errors');
      await browser.close();
      process.exit(1);
    }

    // Get content from both editors
    const content1 = await page1.evaluate(() => {
      return window.__cmView ? window.__cmView.state.doc.toString() : null;
    });

    const content2 = await page2.evaluate(() => {
      return window.__cmView ? window.__cmView.state.doc.toString() : null;
    });

    console.log(`[User 1] Content (last 100 chars): "${content1?.slice(-100) || "NULL"}"`);
    console.log(`[User 2] Content (last 100 chars): "${content2?.slice(-100) || "NULL"}"\n`);

    // Verify sync
    if (!content1 || !content1.includes("COLLABORATION_TEST_123")) {
      console.log("❌ User 1 content missing test string");
      await browser.close();
      process.exit(1);
    }

    if (!content2 || !content2.includes("COLLABORATION_TEST_123")) {
      console.log("❌ FAILED: Text did not sync to User 2");
      console.log('Expected: "COLLABORATION_TEST_123"');
      console.log(`Got: "${content2}"`);
      await browser.close();
      process.exit(1);
    }

    // Test reverse sync - User 2 types
    console.log('[User 2] Typing: " REVERSE_SYNC"');
    await page2.click(".cm-content");
    await page2.keyboard.type(" REVERSE_SYNC");

    await page2.waitForTimeout(5000);

    const finalContent1 = await page1.evaluate(() => {
      return window.__cmView ? window.__cmView.state.doc.toString() : null;
    });

    console.log(
      `\n[User 1] Final content (last 100 chars): "${finalContent1?.slice(-100) || "NULL"}"\n`
    );

    if (!finalContent1 || !finalContent1.includes("REVERSE_SYNC")) {
      console.log("❌ FAILED: Reverse sync did not work");
      await browser.close();
      process.exit(1);
    }

    console.log("✅ ✅ ✅ SUCCESS! Multi-player collaboration is working! ✅ ✅ ✅");
    console.log("- User 1 → User 2 sync: WORKING");
    console.log("- User 2 → User 1 sync: WORKING");
    console.log('- No "update in progress" errors: WORKING');
    console.log("- Cursors visible: Check browser windows\n");

    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    await browser.close();
    process.exit(1);
  }
}

main();
