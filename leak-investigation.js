const puppeteer = require('puppeteer');
const session = require('/Users/leo.torres/.studio/session.json');

async function snapshot(page, cdp, label) {
  await cdp.send('HeapProfiler.collectGarbage');
  await new Promise(r => setTimeout(r, 2000));
  const metrics = await page.metrics();
  const heap = await cdp.send('Runtime.getHeapUsage');
  const live = await page.evaluate(() => {
    let c = 0; function w(n) { c++; for (const ch of n.childNodes) w(ch); } w(document); return c;
  });
  return { label, v8Nodes: Math.round(metrics.Nodes), liveNodes: live, detached: Math.round(metrics.Nodes) - live, heapMB: Math.round(heap.usedSize / 1024 / 1024) };
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const cdp = await page.createCDPSession();

  await page.goto('http://localhost:5175', { waitUntil: 'networkidle0' });
  await page.evaluate((s) => {
    localStorage.setItem('accessToken', s.access_token);
    localStorage.setItem('refreshToken', s.refresh_token);
    localStorage.setItem('user', JSON.stringify(s.user));
  }, session);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.goto('http://localhost:5175/file/327', { waitUntil: 'networkidle0' });

  // Wait for editor AND manuscript
  for (let i = 0; i < 60; i++) {
    const state = await page.evaluate(() => ({
      hrs: document.querySelectorAll('.hr').length,
      cm: !!document.querySelector('.cm-editor'),
      cmContent: !!document.querySelector('.cm-content'),
    }));
    if (state.hrs > 0 && state.cmContent) { console.log('Editor + manuscript ready'); break; }
    if (i === 59) console.log('Timeout waiting for editor');
    await new Promise(r => setTimeout(r, 1000));
  }
  await new Promise(r => setTimeout(r, 10000));

  const results = [];
  results.push(await snapshot(page, cdp, 'T0: baseline'));

  // Check if editor is connected
  const editorState = await page.evaluate(() => ({
    cmContent: !!document.querySelector('.cm-content'),
    cmLines: document.querySelectorAll('.cm-line').length,
    contentEditable: document.querySelector('.cm-content')?.contentEditable,
  }));
  console.log('Editor state:', JSON.stringify(editorState));

  if (!editorState.cmContent) {
    console.log('No editor — cannot simulate typing. Trying WebSocket-based approach...');
  }

  // Type into the editor to trigger real recompiles
  console.log('Typing into editor to trigger recompiles...');
  const cmContent = await page.$('.cm-content');
  
  if (cmContent) {
    await cmContent.click();
    await new Promise(r => setTimeout(r, 1000));

    for (let cycle = 0; cycle < 10; cycle++) {
      // Type a character
      await page.keyboard.type('x');
      // Wait for debounced compile (usually 500ms-1s)
      await new Promise(r => setTimeout(r, 3000));
      // Delete it
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, 3000));

      if (cycle % 3 === 2) {
        const s = await snapshot(page, cdp, `T${results.length}: after ${cycle + 1} type cycles`);
        results.push(s);
        console.log(`  cycle ${cycle + 1}: v8=${s.v8Nodes} live=${s.liveNodes} detached=${s.detached} heap=${s.heapMB}MB`);
      }
    }
  }

  results.push(await snapshot(page, cdp, `T${results.length}: final`));

  console.log('\n' + '='.repeat(80));
  console.log('LEAK INVESTIGATION — REAL TYPING SIMULATION');
  console.log('='.repeat(80));
  console.log(`${'Label'.padEnd(40)} ${'V8 Nodes'.padStart(10)} ${'Live'.padStart(8)} ${'Detached'.padStart(10)} ${'Heap MB'.padStart(8)}`);
  console.log('-'.repeat(80));
  for (const r of results) {
    console.log(`${r.label.padEnd(40)} ${String(r.v8Nodes).padStart(10)} ${String(r.liveNodes).padStart(8)} ${String(r.detached).padStart(10)} ${String(r.heapMB).padStart(8)}`);
  }

  const first = results[0];
  const last = results[results.length - 1];
  console.log(`\nGrowth: nodes=${last.v8Nodes - first.v8Nodes} detached=${last.detached - first.detached} heap=${last.heapMB - first.heapMB}MB`);

  if (last.detached > first.detached + 500) {
    console.log('⚠️  LEAK DETECTED — taking heap snapshot...');
    const chunks = [];
    cdp.on('HeapProfiler.addHeapSnapshotChunk', (params) => chunks.push(params.chunk));
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
    const snap = JSON.parse(chunks.join(''));
    const nodes = snap.nodes;
    const strings = snap.strings;
    const nodeFields = snap.snapshot.meta.node_fields;
    const nfc = nodeFields.length;
    const nameIdx = nodeFields.indexOf('name');
    const sizeIdx = nodeFields.indexOf('self_size');
    const detachIdx = nodeFields.indexOf('detachedness');
    const byName = {};
    for (let i = 0; i < nodes.length; i += nfc) {
      if (detachIdx >= 0 && nodes[i + detachIdx] !== 1) continue;
      const name = strings[nodes[i + nameIdx]];
      const size = nodes[i + sizeIdx];
      if (!byName[name]) byName[name] = { count: 0, size: 0 };
      byName[name].count++; byName[name].size += size;
    }
    const top = Object.entries(byName).sort((a, b) => b[1].count - a[1].count).slice(0, 15);
    console.log(`\n${'Detached'.padEnd(50)} ${'Count'.padStart(8)} ${'KB'.padStart(8)}`);
    console.log('-'.repeat(68));
    for (const [name, info] of top) {
      console.log(`${name.substring(0, 50).padEnd(50)} ${String(info.count).padStart(8)} ${String(Math.round(info.size / 1024)).padStart(8)}`);
    }
  } else {
    console.log('✓ No significant leak detected');
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
