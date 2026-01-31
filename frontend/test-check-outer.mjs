#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

page.on('console', msg => console.log(`[CONSOLE] ${msg.text()}`));
page.on('pageerror', err => console.log(`[ERROR] ${err.message}`));

try {
  console.log('Logging in...');
  await page.goto('http://localhost:5173');
  await page.fill('[data-testid="email-input"]', 'foo@bar.com');
  await page.fill('[data-testid="password-input"]', 'admin');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/', { timeout: 15000 });
  
  console.log('\n=== CHECKING WORKSPACE STATE ===');
  await page.waitForTimeout(3000);
  
  // Check workspace structure
  const workspaceHTML = await page.evaluate(() => {
    const workspace = document.querySelector('.workspace');
    return workspace ? `Found .workspace` : 'No .workspace';
  });
  console.log(`Workspace: ${workspaceHTML}`);
  
  // Check if Editor.vue is rendered
  const editorHTML = await page.evaluate(() => {
    const editor = document.querySelector('.editor');
    return editor ? `Found .editor` : 'No .editor';
  });
  console.log(`Editor: ${editorHTML}`);
  
  // Check EditorCodeMirror
  const cmHTML = await page.evaluate(() => {
    const cm = document.querySelector('.editor-codemirror');
    return cm ? `Found .editor-codemirror` : 'No .editor-codemirror';
  });
  console.log(`EditorCodeMirror: ${cmHTML}`);
  
  // Check if there's a selected file
  const selectedFile = await page.evaluate(() => {
    // Try to find any indication of a selected file
    const urlParams = new URLSearchParams(window.location.search);
    return {
      fileParam: urlParams.get('file'),
      url: window.location.href
    };
  });
  console.log(`\nSelected file param: ${selectedFile.fileParam}`);
  console.log(`URL: ${selectedFile.url}`);
  
  // Try clicking on a file
  console.log('\n=== CLICKING ON A FILE ===');
  const firstFile = await page.locator('[data-testid="file-item"]').first();
  const fileExists = await firstFile.count() > 0;
  
  if (fileExists) {
    console.log('Clicking first file...');
    await firstFile.click();
    await page.waitForTimeout(2000);
    
    // Check again
    const editorAfterClick = await page.evaluate(() => {
      const editor = document.querySelector('.editor');
      const cm = document.querySelector('.editor-codemirror');
      const cmEditor = document.querySelector('.cm-editor');
      return {
        hasEditor: !!editor,
        hasCodeMirror: !!cm,
        hasCMEditor: !!cmEditor
      };
    });
    
    console.log(`After clicking file:`);
    console.log(`  - .editor: ${editorAfterClick.hasEditor}`);
    console.log(`  - .editor-codemirror: ${editorAfterClick.hasCodeMirror}`);
    console.log(`  - .cm-editor: ${editorAfterClick.hasCMEditor}`);
  } else {
    console.log('No files found to click');
  }
  
  console.log('\nPress Ctrl+C to close...');
  await page.waitForTimeout(60000);
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await browser.close();
}
