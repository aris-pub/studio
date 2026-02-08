#!/usr/bin/env node
/* global require, __dirname, console, process */
/**
 * Patch y-codemirror.next to fix echo prevention in Docker environments
 *
 * Root cause: Object identity checks fail in containerized environments
 * Fix: Use transaction.local flag as primary echo detection
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/y-codemirror.next/dist/y-codemirror.cjs');

console.log(`📍 Patch script location: ${__dirname}`);
console.log(`📍 Target file path: ${filePath}`);

if (!fs.existsSync(filePath)) {
  console.error('❌ y-codemirror.next not found. Run npm install first.');
  console.error(`❌ Checked path: ${filePath}`);
  console.error(`❌ Directory contents:`);
  const dir = path.dirname(filePath);
  if (fs.existsSync(dir)) {
    console.error(fs.readdirSync(dir).join(', '));
  }
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');
console.log(`📊 File size: ${content.length} bytes`);

// Check if already patched
if (content.includes('&& !tr.local')) {
  console.log('✅ Already patched - skipping');
  process.exit(0);
}

// Patch: Use transaction.local flag for echo prevention
// OLD: if (tr.origin !== this.conf)
// NEW: if (tr.origin !== this.conf && !tr.local)
const pattern = /if\s*\(\s*tr\.origin\s*!==\s*this\.conf\s*\)/g;
const patched = content.replace(pattern, 'if (tr.origin !== this.conf && !tr.local)');

if (patched === content) {
  console.error('❌ Pattern not found - library may have changed');
  console.error(`❌ Looking for: if (tr.origin !== this.conf)`);
  console.error(`❌ File excerpt around line 172:`);
  const lines = content.split('\n');
  console.error(lines.slice(170, 175).join('\n'));
  process.exit(1);
}

fs.writeFileSync(filePath, patched, 'utf8');
console.log('✅ Patched y-codemirror.next echo prevention for Docker compatibility');
