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
const isPatched = content.includes('&& !tr.local');
const isDebugPatched = content.includes('[ySync DEBUG]');

if (isPatched && isDebugPatched) {
  console.log('✅ Already patched (echo prevention + debugging) - skipping');
  process.exit(0);
}

let patched = content;

// Patch 1: Use transaction.local flag for echo prevention
if (!isPatched) {
  const pattern = /if\s*\(\s*tr\.origin\s*!==\s*this\.conf\s*\)/g;
  patched = patched.replace(pattern, 'if (tr.origin !== this.conf && !tr.local)');

  if (patched === content) {
    console.error('❌ Echo prevention pattern not found - library may have changed');
    console.error(`❌ Looking for: if (tr.origin !== this.conf)`);
    process.exit(1);
  }
  console.log('✅ Applied echo prevention patch');
}

// Patch 2: Add debugging to ViewPlugin.update() method
if (!isDebugPatched) {
  // Find the update method in the ViewPlugin and add logging at the start
  const updatePattern = /(update\s*\([^)]*\)\s*{\s*)/;
  const debugCode = `$1console.log('[ySync DEBUG] update() called', { docChanged: arguments[0]?.docChanged, newLength: arguments[0]?.state?.doc?.length }); `;
  patched = patched.replace(updatePattern, debugCode);

  // Add logging to the observer function when it fires
  const observerPattern = /(this\._observer\s*=\s*\([^)]*\)\s*=>\s*{\s*)/;
  const observerDebugCode = `$1console.log('[ySync DEBUG] Observer fired', { origin: arguments[1]?.origin, deltaLength: arguments[0]?.delta?.length }); `;
  patched = patched.replace(observerPattern, observerDebugCode);

  if (patched === content && !isPatched) {
    console.error('❌ Could not add debugging - update/observer patterns not found');
    process.exit(1);
  }
  console.log('✅ Applied debugging patches');
}

fs.writeFileSync(filePath, patched, 'utf8');
console.log('✅ Patched y-codemirror.next (echo prevention + debugging)');
