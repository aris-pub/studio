#!/usr/bin/env node

/**
 * Test script to verify multi-player collaboration is working
 *
 * This script:
 * 1. Opens two browser instances
 * 2. Logs in to both
 * 3. Opens the same file in both editors
 * 4. Types in one editor
 * 5. Verifies the content appears in the other editor
 */

import { chromium } from 'playwright';

const FRONTEND_URL = 'http://localhost:5173';
const TEST_EMAIL = 'foo@bar.com';
const TEST_PASSWORD = 'admin';
const TIMEOUT = 30000;

async function login(page) {
  console.log('  Logging in...');
  await page.goto(FRONTEND_URL);
  await page.waitForSelector('[data-testid="email-input"]', { timeout: TIMEOUT });
  await page.fill('[data-testid="email-input"]', TEST_EMAIL);
  await page.fill('[data-testid="password-input"]', TEST_PASSWORD);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/', { timeout: TIMEOUT });
  console.log('  ✓ Logged in successfully');
}

async function openFile(page, fileName) {
  console.log(`  Waiting for editor to load...`);

  // Wait for workspace to load
  await page.waitForTimeout(2000);

  // Wait for editor to load (should be visible on workspace page)
  await page.waitForSelector('.cm-editor', { timeout: TIMEOUT });
  console.log('  ✓ Editor loaded');
}

async function getEditorContent(page) {
  // Get content from CodeMirror editor
  return await page.evaluate(() => {
    const editor = document.querySelector('.cm-editor');
    if (!editor) return null;

    // Try to get content from CodeMirror view
    if (window.__cmView) {
      return window.__cmView.state.doc.toString();
    }

    // Fallback: get text content
    return editor.textContent;
  });
}

async function typeInEditor(page, text) {
  console.log(`  Typing text: "${text}"...`);

  // Focus editor and type
  await page.click('.cm-editor .cm-content');
  await page.keyboard.type(text);

  console.log('  ✓ Text typed');
}

async function checkWebSocketConnection(page) {
  const status = await page.evaluate(() => {
    const statusEl = document.querySelector('.status-indicator');
    if (!statusEl) return null;
    return statusEl.textContent.trim();
  });

  console.log(`  WebSocket status: ${status}`);
  return status;
}

async function main() {
  console.log('🧪 Testing Multi-Player Collaboration\n');

  const browser = await chromium.launch({ headless: true });

  try {
    // Create two browser contexts (two separate users)
    console.log('📱 Creating two browser instances...');
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Login both users
    console.log('\n👤 User 1:');
    await login(page1);

    console.log('\n👤 User 2:');
    await login(page2);

    // Open the same file in both editors
    console.log('\n📄 Opening files in both editors...');
    await openFile(page1, 'First file');
    await openFile(page2, 'Same file');

    // Wait for WebSocket connections
    console.log('\n🔌 Checking WebSocket connections...');
    await page1.waitForTimeout(2000); // Give time for WS to connect

    const status1 = await checkWebSocketConnection(page1);
    const status2 = await checkWebSocketConnection(page2);

    if (status1 !== 'Connected' && status1 !== 'Synced') {
      console.error('❌ User 1 not connected to WebSocket');
      process.exit(1);
    }

    if (status2 !== 'Connected' && status2 !== 'Synced') {
      console.error('❌ User 2 not connected to WebSocket');
      process.exit(1);
    }

    console.log('  ✓ Both users connected to WebSocket server');

    // Get initial content from both editors
    console.log('\n📝 Getting initial editor content...');
    const initialContent1 = await getEditorContent(page1);
    const initialContent2 = await getEditorContent(page2);

    console.log(`  User 1 content length: ${initialContent1?.length || 0} chars`);
    console.log(`  User 2 content length: ${initialContent2?.length || 0} chars`);

    // Type in editor 1
    console.log('\n⌨️  User 1 typing...');
    const testText = '\n\n=== COLLAB TEST ===\nThis text was added by the collaboration test.\n';
    await typeInEditor(page1, testText);

    // Wait for sync
    console.log('\n⏳ Waiting for sync (5 seconds)...');
    await page1.waitForTimeout(5000);

    // Get content from both editors
    console.log('\n🔍 Checking if content synced...');
    const finalContent1 = await getEditorContent(page1);
    const finalContent2 = await getEditorContent(page2);

    console.log(`  User 1 final content length: ${finalContent1?.length || 0} chars`);
    console.log(`  User 2 final content length: ${finalContent2?.length || 0} chars`);

    // Check if the test text appears in both editors
    const syncedToUser2 = finalContent2?.includes('COLLAB TEST');

    if (!syncedToUser2) {
      console.error('\n❌ FAILED: Content did not sync between editors');
      console.error('\nUser 1 content (last 200 chars):');
      console.error(finalContent1?.slice(-200));
      console.error('\nUser 2 content (last 200 chars):');
      console.error(finalContent2?.slice(-200));
      process.exit(1);
    }

    console.log('\n✅ SUCCESS: Multi-player collaboration is working!');
    console.log('   Text typed in User 1 appeared in User 2\'s editor');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
