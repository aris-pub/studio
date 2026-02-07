#!/usr/bin/env node
/**
 * Patch y-codemirror.next to fix echo prevention in Docker environments
 *
 * Root cause: Object identity checks fail in containerized environments
 * Fix: Use transaction.local flag as primary echo detection
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/y-codemirror.next/dist/y-codemirror.cjs');

if (!fs.existsSync(filePath)) {
  console.error('❌ y-codemirror.next not found. Run npm install first.');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Patch: Use transaction.local flag for echo prevention
// OLD: if (tr.origin !== this.conf)
// NEW: if (tr.origin !== this.conf && !tr.local)
const patched = content.replace(
  /if\s*\(\s*tr\.origin\s*!==\s*this\.conf\s*\)/g,
  'if (tr.origin !== this.conf && !tr.local)'
);

if (patched === content) {
  console.log('⚠️  Pattern not found - library may have changed. Patch failed.');
  process.exit(1);
}

fs.writeFileSync(filePath, patched, 'utf8');
console.log('✅ Patched y-codemirror.next echo prevention for Docker compatibility');
