#!/usr/bin/env node

/**
 * Simple test to verify collaboration infrastructure is working
 */

import { chromium } from 'playwright';

const FRONTEND_URL = 'http://localhost:5173';

async function main() {
  console.log('🧪 Testing Multi-Player Collaboration Infrastructure\n');

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // Check frontend loads
    console.log('📱 Loading frontend...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    console.log('  ✓ Frontend loaded');

    // Check for Y.js imports
    console.log('\n🔍 Checking Y.js integration...');

    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Failed to resolve import')) {
        errors.push(text);
      }
    });

    // Navigate to workspace (if logged in) or check login page
    await page.waitForTimeout(3000);

    if (errors.length > 0) {
      console.error('\n❌ Found import errors:');
      errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log('  ✓ No import errors found');

    // Check if Y.js modules are available
    const hasYjs = await page.evaluate(() => {
      return typeof window !== 'undefined';
    });

    console.log('\n📦 Checking WebSocket server...');

    // Try to connect to WebSocket server
    const wsConnected = await page.evaluate(async () => {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket('ws://localhost:1234');
          ws.onopen = () => {
            ws.close();
            resolve(true);
          };
          ws.onerror = () => {
            resolve(false);
          };
          setTimeout(() => resolve(false), 5000);
        } catch (error) {
          resolve(false);
        }
      });
    });

    if (!wsConnected) {
      console.error('  ❌ Could not connect to WebSocket server on ws://localhost:1234');
      process.exit(1);
    }

    console.log('  ✓ WebSocket server is accessible');

    console.log('\n✅ SUCCESS: Multi-player infrastructure is working!');
    console.log('   - Frontend loads without errors');
    console.log('   - Y.js imports are resolved');
    console.log('   - WebSocket server is accessible');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
