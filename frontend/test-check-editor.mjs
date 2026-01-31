#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const logs = [];
const errors = [];

page.on('console', msg => {
  const text = msg.text();
  console.log(`[CONSOLE] ${text}`);
  logs.push(text);
});

page.on('pageerror', err => {
  console.log(`[ERROR] ${err.message}`);
  errors.push(err.message);
});

try {
  console.log('Logging in...');
  await page.goto('http://localhost:5173');
  await page.fill('[data-testid="email-input"]', 'foo@bar.com');
  await page.fill('[data-testid="password-input"]', 'admin');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/', { timeout: 15000 });
  
  console.log('Waiting for editor...');
  await page.waitForTimeout(5000);
  
  // Check if editor exists
  const editorCount = await page.locator('.cm-editor').count();
  console.log(`\nEditor count: ${editorCount}`);
  
  // Check if container exists
  const containerCount = await page.locator('.cm-container').count();
  console.log(`Container count: ${containerCount}`);
  
  // Get component HTML
  const editorHTML = await page.evaluate(() => {
    const container = document.querySelector('.editor-codemirror');
    return container ? container.outerHTML.slice(0, 500) : 'NOT FOUND';
  });
  console.log(`\nComponent HTML:\n${editorHTML}`);
  
  if (errors.length > 0) {
    console.log(`\n❌ Errors found:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
  
  console.log('\nPress Ctrl+C to close browser...');
  await page.waitForTimeout(60000);
  
} catch (error) {
  console.error('Test error:', error.message);
} finally {
  await browser.close();
}
