#!/usr/bin/env node
/* global require, __dirname, console, process */
/**
 * Patch y-codemirror.next to fix echo prevention
 * Patches BOTH dist (CommonJS) and src (ES modules) because Vite uses src/
 */

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../node_modules/y-codemirror.next/dist/y-codemirror.cjs');
const srcPath = path.join(__dirname, '../node_modules/y-codemirror.next/src/y-sync.js');

console.log(`📍 Patch script location: ${__dirname}`);

// Check files exist
if (!fs.existsSync(distPath) || !fs.existsSync(srcPath)) {
  console.error('❌ y-codemirror.next not found. Run npm install first.');
  console.error(`❌ Dist exists: ${fs.existsSync(distPath)}`);
  console.error(`❌ Src exists: ${fs.existsSync(srcPath)}`);
  process.exit(1);
}

function patchFile(filePath, fileType) {
  console.log(`\n📝 Patching ${fileType}: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already patched
  const isEchoPatched = content.includes('&& !tr.local') || content.includes('&& !tr.local');
  const isDebugPatched = content.includes('[ySync DEBUG]');

  if (isEchoPatched && isDebugPatched) {
    console.log(`✅ ${fileType} already patched - skipping`);
    return;
  }

  let patched = content;

  // Patch 1: Echo prevention
  if (!isEchoPatched) {
    // CommonJS: if (tr.origin !== this.conf)
    // ES Module: if (tr.origin !== ySyncOrigin)
    const patterns = [
      /if\s*\(\s*tr\.origin\s*!==\s*this\.conf\s*\)/g,
      /if\s*\(\s*tr\.origin\s*!==\s*ySyncOrigin\s*\)/g
    ];

    let applied = false;
    for (const pattern of patterns) {
      const result = patched.replace(pattern, (match) => match.replace(')', ' && !tr.local)'));
      if (result !== patched) {
        patched = result;
        applied = true;
        break;
      }
    }

    if (applied) {
      console.log(`✅ ${fileType}: Applied echo prevention patch`);
    }
  }

  // Patch 2: Add debugging
  if (!isDebugPatched) {
    // Add debugging to update() methods
    const lines = patched.split('\n');
    let patchCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\s*update\s*\(update\)\s*{\s*$/)) {
        const lineNum = i + 1;
        lines[i] = lines[i].replace('{', `{\n    console.log('[ySync DEBUG line ${lineNum}] update() called', update);`);
        patchCount++;
      }
    }

    patched = lines.join('\n');

    // Add observer logging
    patched = patched.replace(
      /(this\._observer\s*=\s*\(event,\s*tr\)\s*=>\s*{\s*)/,
      `$1\n      console.log('[ySync DEBUG] Observer fired', { origin: tr?.origin, eventDelta: event?.delta?.length });\n      `
    );

    console.log(`✅ ${fileType}: Applied debugging (${patchCount} update methods + observer)`);
  }

  // Write patched content
  fs.writeFileSync(filePath, patched, 'utf8');
  console.log(`✅ ${fileType}: Patch complete`);
}

// Patch both files
patchFile(distPath, 'Dist (CommonJS)');
patchFile(srcPath, 'Source (ES Module)');

console.log('\n✅ All patches applied successfully');
