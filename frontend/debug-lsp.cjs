/* global require, console, setTimeout, localStorage */
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const session = JSON.parse(fs.readFileSync(require('os').homedir() + '/.studio/session.json'));
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => localStorage.setItem('auth', JSON.stringify(s)), session);
  await page.goto('http://localhost:5173/file/16', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 8000));
  
  console.log(`Total: ${logs.length} messages\n`);
  console.log('=== Last 20 ===');
  logs.slice(-20).forEach(l => console.log(l));
  
  const editorLogs = logs.filter(l => l.includes('EditorCodeMirror') || l.includes('editor'));
  console.log(`\n=== Editor messages (${editorLogs.length}) ===`);
  editorLogs.forEach(l => console.log(l));

  await browser.close();
})();
