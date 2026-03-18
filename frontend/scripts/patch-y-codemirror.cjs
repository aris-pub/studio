#!/usr/bin/env node
/* global require, __dirname, console, process */
/**
 * Patch y-codemirror.next to fix echo prevention bug
 *
 * PROBLEM:
 * Remote edits echo back to their origin, causing duplicate characters in Docker.
 *
 * ROOT CAUSE:
 * y-codemirror.next uses object identity to prevent echoes:
 *   if (tr.origin !== ySyncOrigin) { ... }
 *
 * This fails in Docker because the ySyncOrigin object created in one module
 * isn't === identical to the same object in another module (different memory addresses).
 *
 * SOLUTION:
 * Replace the identity check with a _syncing flag on the plugin instance. The flag is
 * set only during the sync plugin's own update() -> transact() call, so it blocks only
 * the echo (local edit -> Y.js -> observer -> would-be echo back to CM). Undo/redo
 * transactions fire the observer OUTSIDE the update() call, so _syncing is false and
 * they pass through correctly.
 *
 * Previous approach using !tr.local was too broad: it also blocked Y.UndoManager
 * transactions (which are local), completely breaking Cmd+Z undo.
 *
 * WHY PATCH TWO FILES:
 * - dist/y-codemirror.cjs: Used by CommonJS builds
 * - src/y-sync.js: Used by Vite (ES modules)
 *
 * APPLIED:
 * - Automatically via npm postinstall hook
 * - Automatically via Docker frontend entrypoint
 *
 * SEE ALSO:
 * - ../backend/aris/collaboration/README.md (backend-as-client architecture)
 * - ../../multi-player/README.md (WebSocket server)
 * - ../.claude/CLAUDE.md (Y.js collaboration overview)
 */

const fs = require('fs');
const path = require('path');

// Support both local and hoisted (pnpm node-linker=hoisted) layouts
const candidates = [
  path.join(__dirname, '../node_modules/y-codemirror.next'),
  path.join(__dirname, '../../node_modules/y-codemirror.next'),
];
const pkgDir = candidates.find(d => fs.existsSync(d));

console.log(`📍 Patch script location: ${__dirname}`);

if (!pkgDir) {
  console.error('❌ y-codemirror.next not found in node_modules or hoisted root.');
  process.exit(1);
}

const distPath = path.join(pkgDir, 'dist/y-codemirror.cjs');
const srcPath = path.join(pkgDir, 'src/y-sync.js');

if (!fs.existsSync(distPath) || !fs.existsSync(srcPath)) {
  console.error('❌ y-codemirror.next found but missing dist/src files.');
  console.error(`❌ Dist exists: ${fs.existsSync(distPath)}`);
  console.error(`❌ Src exists: ${fs.existsSync(srcPath)}`);
  process.exit(1);
}

function patchFile(filePath, fileType) {
  console.log(`\n📝 Patching ${fileType}: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  const SYNCING_MARKER = 'this._syncing';

  // Check if already patched with the new _syncing approach
  if (content.includes(SYNCING_MARKER)) {
    console.log(`✅ ${fileType} already patched with _syncing flag - skipping`);
    return;
  }

  // Also remove old !tr.local patch if present
  let patched = content.replace(/\s*&&\s*!tr\.local/g, '');
  if (patched !== content) {
    console.log(`  Removed old !tr.local patch`);
  }

  // --- STEP 1: Add _syncing = false in the YSyncPluginValue constructor ---
  // Match: this._ytext = this.conf.ytext (with optional semicolon)
  // Add: this._syncing = false on the next line
  // This appears only once in the sync plugin constructor.
  const ytextAssign = /(this\._ytext\s*=\s*this\.conf\.ytext;?\n)/;
  if (ytextAssign.test(patched)) {
    patched = patched.replace(ytextAssign, '$1    this._syncing = false\n');
    console.log(`  ✅ Added _syncing = false to constructor`);
  } else {
    console.warn(`  ⚠️ Could not find this._ytext assignment in constructor`);
  }

  // --- STEP 2: Replace observer origin check with _syncing guard ---
  // The observer has: if (tr.origin !== this.conf) {
  // (or in some builds: if (tr.origin !== ySyncOrigin) {)
  // Replace with: if (!this._syncing) {
  const observerPatterns = [
    /if\s*\(\s*tr\.origin\s*!==\s*this\.conf\s*\)/g,
    /if\s*\(\s*tr\.origin\s*!==\s*ySyncOrigin\s*\)/g
  ];

  let observerPatched = false;
  for (const pattern of observerPatterns) {
    if (pattern.test(patched)) {
      patched = patched.replace(pattern, 'if (!this._syncing)');
      observerPatched = true;
      console.log(`  ✅ Replaced observer origin check with _syncing guard`);
      break;
    }
  }
  if (!observerPatched) {
    console.warn(`  ⚠️ Could not find observer origin check to patch`);
  }

  // --- STEP 3: Wrap transact() call with _syncing = true / finally _syncing = false ---
  // Target ONLY the sync plugin's update method, identified by the docChanged guard
  // before the transact call. The pattern is:
  //   const ytext = this.conf.ytext<optional ;>
  //   ytext.doc.transact(() => {
  //     ...
  //   }, this.conf)<optional ;>
  //
  // We wrap the transact call:
  //   const ytext = this.conf.ytext;
  //   this._syncing = true
  //   try {
  //   ytext.doc.transact(() => { ... }, this.conf)
  //   } finally { this._syncing = false }

  // Use multiline match to find the docChanged guard + ytext + transact pattern
  const transactWrap = /(const ytext = this\.conf\.ytext;?\n\s*)(ytext\.doc\.transact\(\(\)\s*=>\s*\{[\s\S]*?\},\s*this\.conf\s*\);?)/;
  const match = patched.match(transactWrap);
  if (match) {
    // Only replace the FIRST occurrence (the sync plugin's update method)
    const fullMatch = match[0];
    const prefix = match[1];
    const transactBlock = match[2];
    const replacement = prefix + 'this._syncing = true\n    try {\n    ' + transactBlock + '\n    } finally { this._syncing = false }';
    patched = patched.replace(fullMatch, replacement);
    console.log(`  ✅ Wrapped transact() with _syncing flag`);
  } else {
    console.warn(`  ⚠️ Could not find transact() call to wrap`);
  }

  // Write patched content
  fs.writeFileSync(filePath, patched, 'utf8');
  console.log(`✅ ${fileType}: Patch complete`);
}

// Patch both files
patchFile(distPath, 'Dist (CommonJS)');
patchFile(srcPath, 'Source (ES Module)');

console.log('\n✅ All patches applied successfully');
