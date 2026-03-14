#!/usr/bin/env node
/* global require, __dirname, console, process */

const { execSync } = require('child_process');

// Skip Playwright browser installation on Netlify — only the y-codemirror patch is needed
if (process.env.NETLIFY !== 'true') {
  console.log('Installing Playwright browsers...');
  execSync('npx playwright install chromium firefox webkit --with-deps', { stdio: 'inherit' });
}

console.log('Applying y-codemirror.next patch...');
execSync('node scripts/patch-y-codemirror.cjs', { stdio: 'inherit', cwd: __dirname + '/..' });
