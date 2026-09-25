#!/usr/bin/env node
/* global require, __dirname, console, process */
/**
 * Verify that patch-y-codemirror.cjs actually applied.
 *
 * WHY THIS EXISTS:
 * patch-y-codemirror.cjs rewrites two files in node_modules on every install to fix an
 * echo bug (remote edits coming back as duplicate characters). Each of its three rewrite
 * steps only console.warns and keeps going when its regex does not match, so an upstream
 * y-codemirror.next change that moves the code a regex targets turns the patch into a
 * silent no-op: the install still succeeds, the echo bug comes back, and no test catches
 * it. This script runs right after the patch in postinstall and exits non-zero when the
 * post-patch markers are missing, so a silent no-op fails the install instead.
 *
 * The check is a static read of the two target files (design a: assert the replacement
 * text the regexes are supposed to produce is present). It does no network or DOM work,
 * so it is deterministic and fast enough to run on every install (local, CI, Netlify).
 *
 * Y_CODEMIRROR_DIR overrides the package location so the check can be pointed at a copy
 * for testing both directions.
 *
 * SEE ALSO: ./patch-y-codemirror.cjs
 */

const fs = require('fs');
const path = require('path');

const override = process.env.Y_CODEMIRROR_DIR;
const candidates = override
  ? [override]
  : [
      path.join(__dirname, '../node_modules/y-codemirror.next'),
      path.join(__dirname, '../../node_modules/y-codemirror.next'),
    ];
const pkgDir = candidates.find(d => fs.existsSync(d));

if (!pkgDir) {
  console.error('❌ verify-y-codemirror-patch: y-codemirror.next not found in node_modules or hoisted root.');
  process.exit(1);
}

const targets = [
  { label: 'Dist (CommonJS)', file: path.join(pkgDir, 'dist/y-codemirror.cjs') },
  { label: 'Source (ES Module)', file: path.join(pkgDir, 'src/y-sync.js') },
];

// Each marker is the exact text one patch step must leave behind. Keep these in sync
// with patch-y-codemirror.cjs: step 1 (constructor init), step 2 (observer guard that
// replaces the origin identity check), step 3 (transact wrap that flips the flag).
const requiredMarkers = [
  { marker: 'this._syncing = false', step: 'step 1: _syncing flag added to constructor' },
  { marker: 'if (!this._syncing)', step: 'step 2: observer guard replaces origin identity check' },
  { marker: 'this._syncing = true', step: 'step 3: transact() wrapped so only the echo is blocked' },
];

const failures = [];

for (const { label, file } of targets) {
  if (!fs.existsSync(file)) {
    failures.push(`${label}: file missing at ${file}`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const { marker, step } of requiredMarkers) {
    if (!content.includes(marker)) {
      failures.push(`${label}: missing "${marker}" (${step})`);
    }
  }
}

if (failures.length > 0) {
  console.error('❌ verify-y-codemirror-patch: the echo-prevention patch did NOT apply.');
  console.error('   Likely cause: y-codemirror.next changed structure and a regex in');
  console.error('   patch-y-codemirror.cjs no longer matches, so the patch silently no-op-ed.');
  console.error('   Remote edits will echo back as duplicate characters. Fix the patch before');
  console.error('   shipping. Missing markers:');
  for (const f of failures) {
    console.error(`     - ${f}`);
  }
  process.exit(1);
}

console.log(`✅ verify-y-codemirror-patch: echo-prevention patch verified in ${pkgDir}`);
